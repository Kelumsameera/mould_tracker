import jwt from "jsonwebtoken";

export const sessionCookie = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === "true",
  sameSite: process.env.COOKIE_SAME_SITE || "lax",
  path: "/",
});

export function setSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
  res.cookie("access_token", token, { ...sessionCookie(), maxAge: 7 * 24 * 60 * 60 * 1000 });
}
