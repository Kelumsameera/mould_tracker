import { test, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import mongoose from "mongoose";
import User from "../models/User.js";
import Passkey from "../models/Passkey.js";
import AuthChallenge from "../models/AuthChallenge.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { passkeyConfig, requirePasskeyOrigin } from "../utils/passkeyConfig.js";
import * as controller from "../controllers/passkeyController.js";

afterEach(() => mock.restoreAll());
const digest = (value) => createHash("sha256").update(value).digest();
const b64 = (value) => Buffer.from(value).toString("base64url");
const origin = "https://tools.example.com";
const rpID = "tools.example.com";
const config = { origin, rpID, rpName: "Tool Tracker" };
function response() {
  return { statusCode: 200, cookies: {}, status(n) { this.statusCode = n; return this; },
    json(body) { this.body = body; return this; }, cookie(k, v) { this.cookies[k] = v; }, clearCookie() {} };
}

test("passkey configuration rejects HTTP LAN, IP RP IDs and mismatched domains", () => {
  for (const value of ["http://tools.example.com", "https://192.168.0.116", "https://tools.example.com/"]) {
    process.env.WEBAUTHN_ORIGIN = value; delete process.env.WEBAUTHN_RP_ID;
    assert.equal(passkeyConfig(), null);
  }
  process.env.WEBAUTHN_ORIGIN = origin; process.env.WEBAUTHN_RP_ID = "attacker.example.com";
  assert.equal(passkeyConfig(), null);
  process.env.WEBAUTHN_RP_ID = rpID;
  assert.equal(passkeyConfig().rpID, rpID);
  let error;
  requirePasskeyOrigin({ get: () => "https://attacker.example.com" }, {}, (e) => { error = e; });
  assert.equal(error.status, 403);
});

test("every role is enforced on the server", () => {
  for (const role of ["admin", "operator", "viewer"]) {
    for (const allowed of [["admin"], ["admin", "operator"]]) {
      let next = false;
      const res = response();
      requireRole(...allowed)({ user: { role } }, res, () => { next = true; });
      assert.equal(next, allowed.includes(role));
      if (!next) assert.equal(res.statusCode, 403);
    }
  }
});

test("session role comes from the database, and disabled users cannot use old sessions", async () => {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
  const token = jwt.sign({ sub: "user", role: "admin" }, process.env.JWT_SECRET);
  let user = { active: true, role: "viewer" };
  mock.method(User, "findById", () => ({ select: async () => user }));
  const req = { cookies: { access_token: token } };
  let next = false;
  await requireAuth(req, response(), () => { next = true; });
  assert.equal(next, true); assert.equal(req.user.role, "viewer");
  user = { active: false, role: "admin" };
  const res = response();
  await requireAuth({ cookies: { access_token: token } }, res, () => assert.fail("disabled session accepted"));
  assert.equal(res.statusCode, 401);
});

// Only persistence is mocked. Registration and assertions use real P-256 keys,
// real CBOR authenticator data, and the production cryptographic verifier.
async function setup() {
  process.env.JWT_SECRET = "test-secret-that-is-at-least-thirty-two-characters";
  const user = { _id: new mongoose.Types.ObjectId(), email: "test@example.com", name: "Test", role: "viewer", active: true,
    passwordHash: await bcrypt.hash("TestPassword123!", 4) };
  const keys = [], challenges = new Map();
  mock.method(User, "findById", async () => user);
  mock.method(Passkey, "find", async () => keys);
  mock.method(Passkey, "create", async (key) => { keys.push({ ...key, _id: new mongoose.Types.ObjectId() }); });
  mock.method(Passkey, "findOne", async (query) => keys.find((k) => k.credentialId === query.credentialId));
  mock.method(Passkey, "findOneAndUpdate", async (query, update) => {
    const key = keys.find((k) => String(k._id) === String(query._id) && k.counter === query.counter);
    if (key) Object.assign(key, update); return key;
  });
  mock.method(AuthChallenge, "create", async (c) => { challenges.set(c.tokenHash, c); });
  mock.method(AuthChallenge, "deleteOne", async (q) => { challenges.delete(q.tokenHash); });
  mock.method(AuthChallenge, "findOneAndDelete", async (q) => {
    const c = challenges.get(q.tokenHash);
    if (!c || c.kind !== q.kind || c.expiresAt <= q.expiresAt.$gt || (q.userId && String(q.userId) !== String(c.userId))) return null;
    challenges.delete(q.tokenHash); return c;
  });
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const cose = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, "base64url")], [-3, Buffer.from(jwk.y, "base64url")]]));
  const credentialId = randomBytes(16), id = b64(credentialId);
  function clientData(type, challenge, website = origin) { return Buffer.from(JSON.stringify({ type, challenge, origin: website, crossOrigin: false })); }
  function registration(challenge, website = origin) {
    const authData = Buffer.concat([digest(rpID), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), Buffer.from([0, 16]), credentialId, cose]);
    return { id, rawId: id, type: "public-key", clientExtensionResults: {}, response: {
      clientDataJSON: b64(clientData("webauthn.create", challenge, website)), transports: ["internal"],
      attestationObject: b64(isoCBOR.encode(new Map([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]))),
    } };
  }
  function assertion(challenge, { website = origin, uv = true, counter = 1, tamper = false } = {}) {
    const count = Buffer.alloc(4); count.writeUInt32BE(counter);
    const authData = Buffer.concat([digest(rpID), Buffer.from([uv ? 0x05 : 0x01]), count]);
    const data = clientData("webauthn.get", challenge, website);
    const signature = sign("sha256", Buffer.concat([authData, digest(data)]), privateKey);
    if (tamper) signature[signature.length - 1] ^= 1;
    return { id, rawId: id, type: "public-key", clientExtensionResults: {}, response: {
      clientDataJSON: b64(data), authenticatorData: b64(authData), signature: b64(signature), userHandle: b64(String(user._id)),
    } };
  }
  async function register() {
    const r = response();
    await controller.registrationOptions({ user, passkeyConfig: config, body: { currentPassword: "TestPassword123!", name: "Test device" } }, r);
    await controller.registrationVerify({ user, passkeyConfig: config, cookies: r.cookies, body: { response: registration(r.body.options.challenge) } }, response());
  }
  async function loginRequest(opts = {}) {
    const r = response();
    await controller.authenticationOptions({ passkeyConfig: config }, r);
    return { passkeyConfig: config, cookies: r.cookies, body: { response: assertion(r.body.options.challenge, opts) } };
  }
  return { user, keys, challenges, registration, register, loginRequest };
}

test("register, verify, issue a role-aware session, and reject challenge replay", async () => {
  const s = await setup(); await s.register(); assert.equal(s.keys.length, 1);
  const req = await s.loginRequest(); const res = response();
  await controller.authenticationVerify(req, res);
  assert.equal(res.body.user.role, "viewer"); assert.ok(res.cookies.access_token);
  assert.equal(s.keys[0].counter, 1);
  await assert.rejects(controller.authenticationVerify(req, response()), (e) => e.status === 400);
});

for (const [name, opts] of [["wrong origin", { website: "https://attacker.example.com" }], ["missing user verification", { uv: false }], ["tampered signature", { tamper: true }]]) {
  test(`passkey login rejects ${name}`, async () => {
    const s = await setup(); await s.register();
    await assert.rejects(controller.authenticationVerify(await s.loginRequest(opts), response()), (e) => e.status === 401);
  });
}

test("expired challenge, disabled account, and stale counter cannot authenticate", async () => {
  const s = await setup(); await s.register();
  const expired = await s.loginRequest();
  for (const c of s.challenges.values()) c.expiresAt = new Date(0);
  await assert.rejects(controller.authenticationVerify(expired, response()), (e) => e.status === 400);
  s.user.active = false;
  await assert.rejects(controller.authenticationVerify(await s.loginRequest(), response()), (e) => e.status === 401);
  s.user.active = true; s.keys[0].counter = 2;
  await assert.rejects(controller.authenticationVerify(await s.loginRequest({ counter: 1 }), response()), (e) => e.status === 401);
});

test("registering a passkey requires the current password", async () => {
  const s = await setup();
  await assert.rejects(controller.registrationOptions({ user: s.user, body: { currentPassword: "wrong", name: "Test" }, passkeyConfig: config }, response()), (e) => e.status === 401);
  assert.equal(s.challenges.size, 0);
});

test("registration challenge cannot be used by a different signed-in account", async () => {
  const s = await setup(); const res = response();
  await controller.registrationOptions({ user: s.user, passkeyConfig: config, body: { currentPassword: "TestPassword123!", name: "Test device" } }, res);
  await assert.rejects(controller.registrationVerify({ user: { _id: new mongoose.Types.ObjectId() }, passkeyConfig: config,
    cookies: res.cookies, body: { response: s.registration(res.body.options.challenge) } }, response()), (e) => e.status === 400);
  assert.equal(s.keys.length, 0);
});

test("passkey deletion is scoped to the current account and requires a password", async () => {
  const s = await setup(); let deletes = 0;
  mock.method(Passkey, "findOneAndDelete", async (q) => { deletes++; assert.equal(q.userId, s.user._id); return null; });
  await assert.rejects(controller.deletePasskey({ user: s.user, params: { id: "other-key" }, body: { currentPassword: "wrong" } }, response()), (e) => e.status === 401);
  assert.equal(deletes, 0);
  await assert.rejects(controller.deletePasskey({ user: s.user, params: { id: "other-key" }, body: { currentPassword: "TestPassword123!" } }, response()), (e) => e.status === 404);
  assert.equal(deletes, 1);
});
