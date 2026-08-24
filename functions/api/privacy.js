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

    const delivery = new FormData();
    delivery.append("_subject", "Mercier Talent Solutions Privacy Request or Appeal");
    delivery.append("_template", "table");
    delivery.append("_captcha", "false");
    delivery.append("_replyto", email);
    delivery.append("_url", new URL(DATA_REQUESTS_PATH, request.url).toString());
    delivery.append("form_name", "Data Requests and Appeals");
    delivery.append("name", name);
    delivery.append("email", email);
    delivery.append("request_type", requestType);
    delivery.append("message", message);

    const deliveryResponse = await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      body: delivery,
      redirect: "follow",
    });

    if (!deliveryResponse.ok) {
      console.error("Privacy request delivery failed.", {
        status: deliveryResponse.status,
      });
      return redirectToDataRequests(request, { error: "send" });
    }

    return redirectToDataRequests(request, { sent: "1" });
  } catch (error) {
    console.error("Privacy form submission failed.", error);
    return redirectToDataRequests(request, { error: "send" });
  }
}
