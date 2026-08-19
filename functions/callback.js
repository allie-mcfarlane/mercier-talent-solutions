const readCookie = (request, name) => {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  const match = cookies.find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
};

const page = (title, message, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;padding:48px;background:#f5f5f3;color:#1a2b46;font-family:Arial,sans-serif}main{max-width:560px;margin:auto;background:#fff;border:1px solid #dddcd7;padding:32px}h1{margin:0 0 12px;font-size:24px}p{margin:0;line-height:1.6}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": "mts_admin_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      },
    },
  );

const handshakePage = (token) => {
  const message = `authorization:github:success:${JSON.stringify({ token })}`;
  const messageLiteral = JSON.stringify(message);

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signing in</title></head><body><p>Signing you in...</p><script>(()=>{const complete=()=>{if(!window.opener){document.body.textContent='The sign-in window can be closed.';return;}window.opener.postMessage(${messageLiteral},'*');window.removeEventListener('message',complete,false);setTimeout(()=>window.close(),250);};window.addEventListener('message',complete,false);if(window.opener){window.opener.postMessage('authorizing:github','*');}else{document.body.textContent='The sign-in window can be closed.';}})();</script></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Set-Cookie": "mts_admin_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      },
    },
  );
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const storedState = readCookie(request, "mts_admin_oauth_state");

  if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) {
    return page("Admin sign-in unavailable", "The GitHub sign-in keys have not been added to Cloudflare yet.", 503);
  }

  if (!code || !returnedState || !storedState || returnedState !== storedState) {
    return page("Sign-in could not be verified", "Please close this window and try signing in again from the admin page.", 400);
  }

  const redirectUri = `${url.origin}/callback`;
  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: env.GITHUB_OAUTH_ID,
      client_secret: env.GITHUB_OAUTH_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    return page("GitHub sign-in failed", "GitHub did not complete the sign-in. Please try again.", 502);
  }

  const tokenResult = await tokenResponse.json();
  const token = typeof tokenResult.access_token === "string" ? tokenResult.access_token : "";

  if (!token) {
    return page("GitHub sign-in failed", "GitHub did not return a valid sign-in token. Please try again.", 502);
  }

  return handshakePage(token);
}
