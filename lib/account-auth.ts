import { env } from "cloudflare:workers";
import { timingSafeEqual } from "node:crypto";

const encoder = new TextEncoder();
const HASH_ITERATIONS = 100_000;
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const REGISTER_WINDOW_SECONDS = 60 * 60;
const PROD_COOKIE = "__Host-rijian_session";
const DEV_COOKIE = "rijian_dev_session";

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export type AccountUser = { id: string; username: string };

function db(): D1Database {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

function pepperBytes(): Uint8Array {
  const pepper = env.AUTH_PEPPER;
  if (!pepper || !/^[a-f0-9]{64}$/i.test(pepper)) {
    throw new Error("AUTH_PEPPER must be a 32-byte hexadecimal secret");
  }
  return Uint8Array.from(Buffer.from(pepper, "hex"));
}

async function hmac(data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", arrayBuffer(pepperBytes()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, arrayBuffer(data)));
}

async function derive(password: string, salt: Uint8Array, iterations = HASH_ITERATIONS): Promise<Uint8Array> {
  const prehash = await hmac(encoder.encode(password));
  const key = await crypto.subtle.importKey("raw", arrayBuffer(prehash), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: arrayBuffer(salt), iterations, hash: "SHA-256" }, key, 256,
  ));
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt);
  return `pbkdf2-sha256:${HASH_ITERATIONS}:${Buffer.from(salt).toString("base64url")}:${Buffer.from(hash).toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const match = /^pbkdf2-sha256:(\d+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(storedHash);
  if (!match) return false;
  const iterations = Number(match[1]);
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > HASH_ITERATIONS) return false;
  const salt = Uint8Array.from(Buffer.from(match[2], "base64url"));
  const expected = Buffer.from(match[3], "base64url");
  if (salt.length !== 16 || expected.length !== 32) return false;
  const actual = Buffer.from(await derive(password, salt, iterations));
  return timingSafeEqual(actual, expected);
}

// Compute the same work for an unknown account to reduce username probing.
const DUMMY_HASH = "pbkdf2-sha256:100000:AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Za-z0-9_]{3,32}$/.test(value)) return null;
  return value.toLowerCase();
}

export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 15 && value.length <= 128 && encoder.encode(value).length <= 1024;
}

function cookieName(request: Request): string {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" ? DEV_COOKIE : PROD_COOKIE;
}

function cookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function sessionToken(request: Request): string | null {
  const token = cookieValue(request.headers.get("cookie"), cookieName(request));
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

async function tokenHash(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return Buffer.from(bytes).toString("hex");
}

export async function currentUser(request: Request): Promise<AccountUser | null> {
  return currentUserFromCookieHeader(request.headers.get("cookie"));
}

export async function currentUserFromCookieHeader(cookieHeader: string | null): Promise<AccountUser | null> {
  const token = cookieValue(cookieHeader, PROD_COOKIE) ?? cookieValue(cookieHeader, DEV_COOKIE);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return db().prepare(
    "SELECT users.id, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ? LIMIT 1",
  ).bind(await tokenHash(token), Math.floor(Date.now() / 1000)).first<AccountUser>();
}

export async function registerUser(username: string, normalized: string, password: string): Promise<AccountUser | null> {
  const user = { id: crypto.randomUUID(), username };
  const passwordHash = await hashPassword(password);
  try {
    await db().prepare(
      "INSERT INTO users (id, username, username_normalized, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    ).bind(user.id, username, normalized, passwordHash, Math.floor(Date.now() / 1000)).run();
    return user;
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return null;
    throw error;
  }
}

export async function authenticateUser(normalized: string, password: string): Promise<AccountUser | null> {
  const row = await db().prepare(
    "SELECT id, username, password_hash AS passwordHash FROM users WHERE username_normalized = ? LIMIT 1",
  ).bind(normalized).first<AccountUser & { passwordHash: string }>();
  const valid = await verifyPassword(password, row?.passwordHash ?? DUMMY_HASH);
  return row && valid ? { id: row.id, username: row.username } : null;
}

export async function createSession(request: Request, userId: string): Promise<string> {
  const token = Buffer.from(randomBytes(32)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  await db().prepare(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).bind(await tokenHash(token), userId, now, now + SESSION_SECONDS).run();
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${cookieName(request) === PROD_COOKIE ? "; Secure" : ""}`;
}

export async function deleteSession(request: Request): Promise<void> {
  const token = sessionToken(request);
  if (token) await db().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await tokenHash(token)).run();
}

export function expiredSessionCookie(request: Request): string {
  return `${cookieName(request)}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${cookieName(request) === PROD_COOKIE ? "; Secure" : ""}`;
}

async function limitKey(kind: string, identity: string): Promise<string> {
  return `${kind}:${Buffer.from(await hmac(encoder.encode(identity))).toString("hex")}`;
}

async function rateLimited(key: string, windowSeconds: number, maximum: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db().prepare("SELECT attempts, window_started_at AS windowStartedAt FROM auth_limits WHERE key = ?")
    .bind(key).first<{ attempts: number; windowStartedAt: number }>();
  return !!row && now - row.windowStartedAt < windowSeconds && row.attempts >= maximum;
}

async function recordAttempt(key: string, windowSeconds: number): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db().prepare(
    "INSERT INTO auth_limits (key, attempts, window_started_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN window_started_at <= ? THEN 1 ELSE attempts + 1 END, window_started_at = CASE WHEN window_started_at <= ? THEN ? ELSE window_started_at END",
  ).bind(key, now, now - windowSeconds, now - windowSeconds, now).run();
}

export async function loginAllowed(normalized: string): Promise<boolean> {
  return !(await rateLimited(await limitKey("login", normalized), LOGIN_WINDOW_SECONDS, 10));
}

export async function recordLoginFailure(normalized: string): Promise<void> {
  await recordAttempt(await limitKey("login", normalized), LOGIN_WINDOW_SECONDS);
}

export async function clearLoginFailures(normalized: string): Promise<void> {
  await db().prepare("DELETE FROM auth_limits WHERE key = ?").bind(await limitKey("login", normalized)).run();
}

export async function registrationAllowed(request: Request): Promise<boolean> {
  const ip = request.headers.get("cf-connecting-ip");
  if (!ip) return true;
  const key = await limitKey("register", ip);
  if (await rateLimited(key, REGISTER_WINDOW_SECONDS, 5)) return false;
  await recordAttempt(key, REGISTER_WINDOW_SECONDS);
  return true;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; }
  catch { return false; }
}

export async function readSmallJson(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 4096) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

export function noStoreJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
