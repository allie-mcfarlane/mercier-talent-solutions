const DATA_REQUESTS_PATH = "/data-requests/";
const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/ajax/julia@merciertalentsolutions.com";

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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();

    if (textValue(formData, "_honey", 200)) {
      return redirectToDataRequests(request, { sent: "1" });
    }

    const email = textValue(formData, "email", 254);
    const token = textValue(formData, "cf-turnstile-response", 2048);

    if (!email || !email.includes("@") || !token) {
      return redirectToDataRequests(request, { error: "verification" });
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
      name: textValue(formData, "name", 150),
      email,
      request_type: textValue(formData, "request_type", 160),
      message: textValue(formData, "message", 10000),
    };

    const sendResponse = await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    let sendResult = null;
    try {
      sendResult = await sendResponse.json();
    } catch {
      // A successful HTTP response is enough if FormSubmit does not return JSON.
    }

    if (!sendResponse.ok || sendResult?.success === false) {
      console.error("FormSubmit rejected privacy submission.", {
        status: sendResponse.status,
      });
      return redirectToDataRequests(request, { error: "send" });
    }

    return redirectToDataRequests(request, { sent: "1" });
  } catch (error) {
    console.error("Privacy form submission failed.", error);
    return redirectToDataRequests(request, { error: "send" });
  }
}
