const randomHex = (bytes = 16) => {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => value.toString(16).padStart(2, "0")).join("");
};

const setupError = (message) =>
  new Response(message, {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);

  if (url.searchParams.get("provider") !== "github") {
    return new Response("Unsupported sign-in provider.", { status: 400 });
  }

  if (!env.GITHUB_OAUTH_ID) {
    return setupError("Admin sign-in is not configured yet.");
  }

  const state = randomHex();
  const redirectUri = `${url.origin}/callback`;
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");

  authorizeUrl.searchParams.set("client_id", env.GITHUB_OAUTH_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "public_repo,user");
  authorizeUrl.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `mts_admin_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
}
