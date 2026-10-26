// Prints an ADMIN_PASSWORD_HASH for the password read from stdin (nothing is stored or logged).
import { randomBytes, scryptSync } from "node:crypto";

const chunks = [];
for await (const c of process.stdin) chunks.push(c);
const password = Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
if (password.length < 8) {
  console.error("Password must be at least 8 characters (pipe it on stdin).");
  process.exit(1);
}
const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r, p });
console.log(`scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${hash.toString("base64url")}`);
