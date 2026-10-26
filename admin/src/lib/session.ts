import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "boba_admin";
export const SESSION_TTL_SEC = 7 * 24 * 3600;

interface Session {
  u: string;
  exp: number;
}

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

/** Login is disabled (fails closed) until every secret is configured. */
export function authConfigured(): boolean {
  const secret = env("ADMIN_SESSION_SECRET");
  return !!(env("ADMIN_USERNAME") && env("ADMIN_PASSWORD_HASH") && secret && secret.length >= 32);
}

const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** Verifies `password` against `scrypt:N:r:p:salt:hash` (base64url; no `$`, which .env files would expand). */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0) || N > 2 ** 20) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (!salt.length || !expected.length) return false;
  try {
    return safeEqual(scryptSync(password.normalize("NFC"), salt, expected.length, { N, r, p, maxmem: 256 * N * r }), expected);
  } catch {
    return false;
  }
}

export function checkCredentials(username: string, password: string): boolean {
  const user = env("ADMIN_USERNAME");
  const hash = env("ADMIN_PASSWORD_HASH");
  if (!user || !hash || !authConfigured()) return false;
  // Always run scrypt so a wrong username takes as long as a wrong password.
  const passOk = verifyPassword(password, hash);
  const userOk = safeEqual(Buffer.from(username), Buffer.from(user));
  return passOk && userOk;
}

/** Signing key also covers the password hash, so changing the password logs every session out. */
function sign(data: string): string {
  const key = `${env("ADMIN_SESSION_SECRET")}|${env("ADMIN_PASSWORD_HASH")}`;
  return createHmac("sha256", key).update(data).digest("base64url");
}

export function createSessionToken(username: string, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ u: username, exp: now + SESSION_TTL_SEC * 1000 } satisfies Session)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(token: string | undefined, now = Date.now()): Session | null {
  if (!token || !authConfigured()) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac || !safeEqual(Buffer.from(mac), Buffer.from(sign(body)))) return null;
  try {
    const s = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
    return typeof s.exp === "number" && s.exp > now && s.u === env("ADMIN_USERNAME") ? s : null;
  } catch {
    return null;
  }
}
