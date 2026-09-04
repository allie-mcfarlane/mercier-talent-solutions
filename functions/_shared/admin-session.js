import { getAccessEmail } from "./access-user.js";

const SESSION_COOKIE = "__Secure-mts_admin_session";
const CSRF_COOKIE = "__Secure-mts_admin_csrf";
const SESSION_VERSION = 1;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const encoder = new TextEncoder();

const ALLOWED_USERS = new Map([
  ["allie@merciertalentsolutions.com", { login: "allie-mcfarlane", name: "Allie McFarlane" }],
  ["julia@merciertalentsolutions.com", { login: "julia", name: "Julia Mercier" }],
]);

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const bytesToBase64Url = (bytes) => {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const textToBase64Url = (value) => bytesToBase64Url(encoder.encode(String(value || "")));

const base64UrlToText = (value) => {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
};

const parseCookies = (header) => {
  const cookies = new Map();
  String(header || "").split(";").forEach((part) => {
    const separator = part.indexOf("=");
    if (separator < 0) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  });
  return cookies;
};

const secureEqual = (left, right) => {
  const a = encoder.encode(String(left || ""));
  const b = encoder.encode(String(right || ""));
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
};

const signingSecret = (env) => String(env?.ADMIN_SESSION_SECRET || env?.GITHUB_ADMIN_TOKEN || "");

const sign = async (value, env) => {
  const secret = signingSecret(env);
  if (!secret) throw new Error("Admin session signing is not configured.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`mts-admin-session-v${SESSION_VERSION}.${value}`),
  );
  return bytesToBase64Url(new Uint8Array(signature));
};

const randomToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};

const authorizationToken = (request) => {
  const direct = String(request.headers.get("x-mts-csrf") || "").trim();
  if (direct) return direct;
  const authorization = String(request.headers.get("authorization") || "").trim();
  const match = authorization.match(/^(?:token|bearer)\s+(.+)$/i);
  return match ? match[1].trim() : "";
};

const sameOriginWrite = (request) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin) {
    if (origin !== url.origin) return false;
  } else {
    const referer = request.headers.get("referer");
    if (!referer) return false;
    try {
      if (new URL(referer).origin !== url.origin) return false;
    } catch {
      return false;
    }
  }

  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  return !fetchSite || fetchSite === "same-origin";
};

export async function getAllowedAdminUser(request) {
  const email = normalizeEmail(await getAccessEmail(request));
  const user = ALLOWED_USERS.get(email);
  return user ? { ...user, email } : null;
}

export async function createAdminSession(env, user) {
  if (!user?.email) throw new Error("Authorized admin user is required.");
  const csrf = randomToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = textToBase64Url(JSON.stringify({
    v: SESSION_VERSION,
    email: normalizeEmail(user.email),
    csrf,
    exp: expiresAt,
  }));
  const signature = await sign(payload, env);
  return {
    csrf,
    expiresAt,
    value: `${payload}.${signature}`,
  };
}

export function appendAdminSessionCookies(headers, session) {
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${session.value}; Path=/admin; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Strict`,
  );
  headers.append(
    "Set-Cookie",
    `${CSRF_COOKIE}=${session.csrf}; Path=/admin; Max-Age=${SESSION_TTL_SECONDS}; Secure; SameSite=Strict`,
  );
}

export async function verifyAdminSession(request, env) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const value = cookies.get(SESSION_COOKIE) || "";
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const receivedSignature = value.slice(separator + 1);
  let expectedSignature;
  try { expectedSignature = await sign(payload, env); }
  catch { return null; }
  if (!secureEqual(receivedSignature, expectedSignature)) return null;

  let session;
  try { session = JSON.parse(base64UrlToText(payload)); }
  catch { return null; }
  if (session?.v !== SESSION_VERSION) return null;
  if (!session?.email || !session?.csrf || !Number.isFinite(session?.exp)) return null;
  if (session.exp <= Math.floor(Date.now() / 1000)) return null;
  return session;
}

export async function authorizeAdminRequest(request, env) {
  const user = await getAllowedAdminUser(request);
  if (!user) return { ok: false, status: 403, message: "Access denied." };

  const session = await verifyAdminSession(request, env);
  if (!session || !secureEqual(session.email, user.email)) {
    return { ok: false, status: 401, message: "Admin session expired. Refresh the editor and try again." };
  }

  const method = request.method.toUpperCase();
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (unsafe) {
    if (!sameOriginWrite(request)) {
      return { ok: false, status: 403, message: "Cross-origin request blocked." };
    }

    const presentedToken = authorizationToken(request);
    if (!presentedToken || !secureEqual(presentedToken, session.csrf)) {
      return { ok: false, status: 403, message: "Invalid admin session token." };
    }
  }

  return { ok: true, user, session, csrfVerified: unsafe };
}
