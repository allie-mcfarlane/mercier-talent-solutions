const DATA_REQUESTS_PATH = "/data-requests/";
const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/julia@merciertalentsolutions.com";

const MIN_FORM_AGE_MS = 1500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u;
const ALLOWED_REQUEST_TYPES = new Set([
  "Access my personal information",
  "Correct my personal information",
  "Delete my personal information",
  "Request a copy of my personal information",
  "Appeal a previous privacy request decision",
  "General privacy question or request",
]);

const redirectToDataRequests = (request, params) => {
  const url = new URL(DATA_REQUESTS_PATH, request.url);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return new Response(null, {
    status: 303,
    headers: {
      Location: url.toString(),
      "Cache-Control": "no-store",
    },
  });
};

const textValue = (formData, name, maxLength = 10000) => {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const hasPlausibleFormTiming = (value) => {
  const startedAt = Number(value);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return false;

  const age = Date.now() - startedAt;
  return age >= MIN_FORM_AGE_MS && age <= MAX_FORM_AGE_MS;
};

const looksLikeHumanName = (value) =>
  !value || (value.length <= 120 && NAME_PATTERN.test(value));

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const hiddenInput = (name, value) =>
  `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`;

const browserDeliveryResponse = (request, payload) => {
  const successUrl = new URL(DATA_REQUESTS_PATH, request.url);
  successUrl.searchParams.set("sent", "1");

  const fields = [
    hiddenInput("_subject", payload._subject),
    hiddenInput("_template", payload._template),
    hiddenInput("_captcha", payload._captcha),
    hiddenInput("_replyto", payload._replyto),
    hiddenInput("_next", successUrl.toString()),
    hiddenInput("_url", payload._url),
    hiddenInput("form_name", payload.form_name),
    hiddenInput("name", payload.name),
    hiddenInput("email", payload.email),
    hiddenInput("request_type", payload.request_type),
    `<textarea name="message" hidden>${escapeHtml(payload.message)}</textarea>`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sending request…</title>
  </head>
  <body>
    <form id="privacy-delivery" action="${escapeHtml(FORMSUBMIT_ENDPOINT)}" method="POST">
      ${fields}
      <noscript>
        <p>Your security check passed. Select Continue to submit your request.</p>
        <button type="submit">Continue</button>
      </noscript>
    </form>
    <script>document.getElementById("privacy-delivery").submit();</script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();

    if (
      textValue(formData, "_honey", 200) ||
      textValue(formData, "company_website", 500)
    ) {
      return redirectToDataRequests(request, { sent: "1" });
    }

    const name = textValue(formData, "name", 150);
    const email = textValue(formData, "email", 254);
    const requestType = textValue(formData, "request_type", 160);
    const message = textValue(formData, "message", 10000);
    const token = textValue(formData, "cf-turnstile-response", 2048);
    const formStartedAt = textValue(formData, "form_started_at", 40);

    if (
      !EMAIL_PATTERN.test(email) ||
      !token ||
      !hasPlausibleFormTiming(formStartedAt) ||
      !looksLikeHumanName(name)
    ) {
      return redirectToDataRequests(request, { error: "verification" });
    }

    if (!ALLOWED_REQUEST_TYPES.has(requestType)) {
      return redirectToDataRequests(request, { error: "details" });
    }

    if (!env.TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY is not configured.");
      return redirectToDataRequests(request, { error: "send" });
    }

    const verifyBody = new FormData();
    verifyBody.append("secret", env.TURNSTILE_SECRET_KEY);
    verifyBody.append("response", token);

    const remoteIp = request.headers.get("CF-Connecting-IP");
    if (remoteIp) verifyBody.append("remoteip", remoteIp);

    const verificationResponse = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: verifyBody,
      },
    );

    if (!verificationResponse.ok) {
      console.error("Turnstile verification request failed for privacy form.");
      return redirectToDataRequests(request, { error: "verification" });
    }

    const verification = await verificationResponse.json();
    const requestHostname = new URL(request.url).hostname;

    if (
      !verification.success ||
      verification.action !== "privacy" ||
      verification.hostname !== requestHostname
    ) {
      console.warn("Turnstile rejected privacy submission.", {
        hostname: verification.hostname,
        action: verification.action,
        errors: verification["error-codes"],
      });
      return redirectToDataRequests(request, { error: "verification" });
    }

    const payload = {
      _subject: "Mercier Talent Solutions Privacy Request or Appeal",
      _template: "table",
      _captcha: "false",
      _replyto: email,
      _url: new URL(DATA_REQUESTS_PATH, request.url).toString(),
      form_name: "Data Requests and Appeals",
      name,
      email,
      request_type: requestType,
      message,
    };

    return browserDeliveryResponse(request, payload);
  } catch (error) {
    console.error("Privacy form submission failed.", error);
    return redirectToDataRequests(request, { error: "send" });
  }
}
