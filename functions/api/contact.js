const CONTACT_PATH = "/contactus/";
const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/allie@merciertalentsolutions.com";

const ALLOWED_INTERESTS = new Set([
  "Executive Coaching",
  "Assessments",
  "Training",
  "Consulting",
  "White Papers",
  "Other",
]);

const MIN_FORM_AGE_MS = 1500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const redirectToContact = (request, params) => {
  const url = new URL(CONTACT_PATH, request.url);
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

const looksLikeHumanName = (value) => {
  if (!value) return true;
  return value.length <= 80 && NAME_PATTERN.test(value);
};

const hasPlausibleFormTiming = (value) => {
  const startedAt = Number(value);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return false;

  const age = Date.now() - startedAt;
  return age >= MIN_FORM_AGE_MS && age <= MAX_FORM_AGE_MS;
};

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
  const successUrl = new URL(CONTACT_PATH, request.url);
  successUrl.searchParams.set("sent", "1");

  const fields = [
    hiddenInput("_subject", payload._subject),
    hiddenInput("_template", payload._template),
    hiddenInput("_captcha", payload._captcha),
    hiddenInput("_cc", payload._cc),
    hiddenInput("_replyto", payload._replyto),
    hiddenInput("_next", successUrl.toString()),
    hiddenInput("_url", payload._url),
    hiddenInput("form_name", payload.form_name),
    hiddenInput("browser_privacy_signal", payload.browser_privacy_signal),
    hiddenInput("first_name", payload.first_name),
    hiddenInput("last_name", payload.last_name),
    hiddenInput("email", payload.email),
    hiddenInput("interest", payload.interest),
    `<textarea name="message" hidden>${escapeHtml(payload.message)}</textarea>`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sending message…</title>
  </head>
  <body>
    <form id="contact-delivery" action="${escapeHtml(FORMSUBMIT_ENDPOINT)}" method="POST">
      ${fields}
      <noscript>
        <p>Your security check passed. Select Continue to send your message.</p>
        <button type="submit">Continue</button>
      </noscript>
    </form>
    <script>document.getElementById("contact-delivery").submit();</script>
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
      return redirectToContact(request, { sent: "1" });
    }

    const firstName = textValue(formData, "first_name", 100);
    const lastName = textValue(formData, "last_name", 100);
    const email = textValue(formData, "email", 254);
    const interest = textValue(formData, "interest", 120);
    const message = textValue(formData, "message", 10000);
    const token = textValue(formData, "cf-turnstile-response", 2048);
    const formStartedAt = textValue(formData, "form_started_at", 40);

    if (!email || !EMAIL_PATTERN.test(email) || !token) {
      return redirectToContact(request, { error: "verification" });
    }

    if (!hasPlausibleFormTiming(formStartedAt)) {
      return redirectToContact(request, { error: "verification" });
    }

    if (!looksLikeHumanName(firstName) || !looksLikeHumanName(lastName)) {
      return redirectToContact(request, { sent: "1" });
    }

    if (interest && !ALLOWED_INTERESTS.has(interest)) {
      return redirectToContact(request, { sent: "1" });
    }

    if (!interest && message.length < 8) {
      return redirectToContact(request, { error: "details" });
    }

    if (!env.TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY is not configured.");
      return redirectToContact(request, { error: "send" });
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
      console.error("Turnstile verification request failed.");
      return redirectToContact(request, { error: "verification" });
    }

    const verification = await verificationResponse.json();
    const requestHostname = new URL(request.url).hostname;

    if (
      !verification.success ||
      verification.action !== "contact" ||
      verification.hostname !== requestHostname
    ) {
      console.warn("Turnstile rejected contact submission.", {
        hostname: verification.hostname,
        action: verification.action,
        errors: verification["error-codes"],
      });
      return redirectToContact(request, { error: "verification" });
    }

    const payload = {
      _subject: "Mercier Talent Solutions Contact Form",
      _template: "table",
      _captcha: "false",
      _cc: "julia@merciertalentsolutions.com",
      _replyto: email,
      _url: new URL(CONTACT_PATH, request.url).toString(),
      form_name: "Contact Us",
      browser_privacy_signal: textValue(
        formData,
        "browser_privacy_signal",
        80,
      ),
      first_name: firstName,
      last_name: lastName,
      email,
      interest,
      message,
    };

    return browserDeliveryResponse(request, payload);
  } catch (error) {
    console.error("Contact form submission failed.", error);
    return redirectToContact(request, { error: "send" });
  }
}
