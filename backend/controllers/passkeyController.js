import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import Passkey from "../models/Passkey.js";
import AuthChallenge from "../models/AuthChallenge.js";
import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { userDTO } from "../utils/serializers.js";
import { setSession } from "../utils/session.js";
import { passkeyConfig } from "../utils/passkeyConfig.js";

const COOKIE = "passkey_challenge";
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "strict", path: "/api/auth/passkeys" });
const hash = (value) => createHash("sha256").update(value).digest("hex");

async function createChallenge(req, res, options, kind, extra = {}) {
  const oldToken = req.cookies?.[COOKIE];
  if (typeof oldToken === "string") await AuthChallenge.deleteOne({ tokenHash: hash(oldToken) });
  const token = randomBytes(32).toString("base64url");
  await AuthChallenge.create({ tokenHash: hash(token), challenge: options.challenge, kind, ...extra, expiresAt: new Date(Date.now() + 300_000) });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: 300_000 });
  res.json({ options });
}

async function consumeChallenge(req, res, kind) {
  res.clearCookie(COOKIE, cookieOptions());
  const token = req.cookies?.[COOKIE];
  if (typeof token !== "string") throw new ApiError(400, "Passkey request expired. Please try again");
  const filter = { tokenHash: hash(token), kind, expiresAt: { $gt: new Date() } };
  if (kind === "register") filter.userId = req.user._id;
  const challenge = await AuthChallenge.findOneAndDelete(filter);
  if (!challenge) throw new ApiError(400, "Passkey request expired or already used. Please try again");
  return challenge;
}

export function capabilities(req, res) {
  res.json({ enabled: !!passkeyConfig() });
}

export async function registrationOptions(req, res) {
  const user = await User.findById(req.user._id);
  if (!user?.active || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) {
    throw new ApiError(401, "Current password is incorrect");
  }
  const keys = await Passkey.find({ userId: user._id });
  if (keys.length >= 10) throw new ApiError(400, "Remove an existing passkey before adding another");
  const { rpID, rpName } = req.passkeyConfig;
  const options = await generateRegistrationOptions({
    rpID, rpName, userID: Buffer.from(String(user._id)), userName: user.email, userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: keys.map((key) => ({ id: key.credentialId, transports: key.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await createChallenge(req, res, options, "register", { userId: user._id, name: req.body.name });
}

export async function registrationVerify(req, res) {
  const challenge = await consumeChallenge(req, res, "register");
  let result;
  try {
    result = await verifyRegistrationResponse({ response: req.body.response, expectedChallenge: challenge.challenge,
      expectedOrigin: req.passkeyConfig.origin, expectedRPID: req.passkeyConfig.rpID, requireUserVerification: true });
  } catch { throw new ApiError(400, "Passkey registration could not be verified"); }
  if (!result.verified || !result.registrationInfo) throw new ApiError(400, "Passkey registration failed");
  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  await Passkey.create({ userId: req.user._id, credentialId: credential.id, publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter, transports: credential.transports || [], name: challenge.name,
    deviceType: credentialDeviceType, backedUp: credentialBackedUp });
  res.status(201).json({ success: true });
}

export async function authenticationOptions(req, res) {
  const options = await generateAuthenticationOptions({ rpID: req.passkeyConfig.rpID, userVerification: "required" });
  await createChallenge(req, res, options, "login");
}

export async function authenticationVerify(req, res) {
  const challenge = await consumeChallenge(req, res, "login");
  const response = req.body.response;
  const key = await Passkey.findOne({ credentialId: response.id });
  const user = key && await User.findById(key.userId);
  if (!user?.active || response.response?.userHandle !== Buffer.from(String(user._id)).toString("base64url")) {
    throw new ApiError(401, "Passkey login failed");
  }
  let result;
  try {
    result = await verifyAuthenticationResponse({ response, expectedChallenge: challenge.challenge,
      expectedOrigin: req.passkeyConfig.origin, expectedRPID: req.passkeyConfig.rpID, requireUserVerification: true,
      credential: { id: key.credentialId, publicKey: new Uint8Array(key.publicKey), counter: key.counter, transports: key.transports } });
  } catch { throw new ApiError(401, "Passkey login failed"); }
  if (!result.verified) throw new ApiError(401, "Passkey login failed");
  const updated = await Passkey.findOneAndUpdate({ _id: key._id, counter: key.counter }, {
    counter: result.authenticationInfo.newCounter, lastUsedAt: new Date(),
  });
  if (!updated) throw new ApiError(401, "Passkey changed during login. Please try again");
  setSession(res, user);
  res.json({ success: true, user: userDTO(user) });
}

export async function listPasskeys(req, res) {
  const keys = await Passkey.find({ userId: req.user._id }).sort({ createdAt: -1 });
  res.json({ passkeys: keys.map((key) => ({ id: String(key._id), name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt })) });
}

export async function deletePasskey(req, res) {
  const user = await User.findById(req.user._id);
  if (!user?.active || !(await bcrypt.compare(req.body.currentPassword, user.passwordHash))) throw new ApiError(401, "Current password is incorrect");
  const key = await Passkey.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
  if (!key) throw new ApiError(404, "Passkey not found");
  res.json({ success: true });
}
