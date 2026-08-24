import { getAccessEmail } from "../_shared/access-user.js";

const ALLOWED_USERS = new Map([
  ["allie@merciertalentsolutions.com", { login: "allie-mcfarlane", name: "Allie McFarlane" }],
  ["julia@merciertalentsolutions.com", { login: "julia", name: "Julia Mercier" }],
]);

const responseHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
};

const errorPage = (title, message, status) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;padding:48px;background:#f5f5f3;color:#1a2b46;font-family:Arial,sans-serif}main{max-width:560px;margin:auto;background:#fff;border:1px solid #dddcd7;padding:32px}h1{margin:0 0 12px;font-size:24px}p{margin:0;line-height:1.6}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`,
    { status, headers: responseHeaders },
  );

export async function onRequestGet({ request }) {
  const url = new URL(request.url);

  if (url.searchParams.get("provider") !== "github") {
    return errorPage("Unsupported sign-in", "This admin only supports the Mercier access flow.", 400);
  }

  const email = await getAccessEmail(request);
  const user = ALLOWED_USERS.get(email);

  if (!user) {
    return errorPage("Access denied", "This email address is not authorized to edit the Mercier Talent Solutions website.", 403);
  }

  const token = "mts-cloudflare-access";
  const successMessage = `authorization:github:success:${JSON.stringify({ token })}`;
  const successLiteral = JSON.stringify(successMessage);

  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Opening admin</title><style>body{margin:0;padding:48px;background:#f5f5f3;color:#1a2b46;font-family:Arial,sans-serif}main{max-width:520px;margin:auto;background:#fff;border:1px solid #dddcd7;padding:32px}h1{margin:0 0 12px;font-size:24px}p{margin:0;line-height:1.6}</style></head><body><main><h1>Opening Mercier Admin</h1><p>Signed in as ${email}. This window will close automatically.</p></main><script>(()=>{const origin=window.location.origin;const complete=(event)=>{if(event.origin!==origin||event.data!=="authorizing:github"||!window.opener)return;window.opener.postMessage(${successLiteral},origin);window.removeEventListener("message",complete,false);setTimeout(()=>window.close(),200);};window.addEventListener("message",complete,false);if(window.opener){window.opener.postMessage("authorizing:github",origin);}else{document.querySelector("p").textContent="Return to the admin page to continue.";}})();</script></body></html>`,
    { headers: responseHeaders },
  );
}
