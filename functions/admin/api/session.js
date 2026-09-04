import {
  appendAdminSessionCookies,
  createAdminSession,
  getAllowedAdminUser,
} from "../../_shared/admin-session.js";

const json = (value, status = 200, headers = new Headers()) => {
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(JSON.stringify(value), { status, headers });
};

const allowedRequestContext = (request) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
};

export async function onRequestGet({ request, env }) {
  if (!allowedRequestContext(request)) {
    return json({ message: "Cross-origin request blocked." }, 403);
  }

  const user = await getAllowedAdminUser(request);
  if (!user) return json({ message: "Access denied." }, 403);

  let session;
  try { session = await createAdminSession(env, user); }
  catch {
    return json({ message: "Admin session signing is not configured." }, 503);
  }

  const headers = new Headers();
  appendAdminSessionCookies(headers, session);
  return json({
    authenticated: true,
    csrf: session.csrf,
    expiresAt: session.expiresAt,
    user: {
      login: user.login,
      name: user.name,
      email: user.email,
    },
  }, 200, headers);
}
