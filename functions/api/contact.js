const CONTACT_PATH = "/contactus/";
const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/ajax/allie@merciertalentsolutions.com";

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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();

    if (textValue(formData, "_honey", 200)) {
      return redirectToContact(request, { sent: "1" });
    }

    const email = textValue(formData, "email", 254);
    const token = textValue(formData, "cf-turnstile-response", 2048);

    if (!email || !email.includes("@") || !token) {
      return redirectToContact(request, { error: "verification" });
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
      first_name: textValue(formData, "first_name", 100),
      last_name: textValue(formData, "last_name", 100),
      email,
      interest: textValue(formData, "interest", 120),
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
      console.error("FormSubmit rejected contact submission.", {
        status: sendResponse.status,
      });
      return redirectToContact(request, { error: "send" });
    }

    return redirectToContact(request, { sent: "1" });
  } catch (error) {
    console.error("Contact form submission failed.", error);
    return redirectToContact(request, { error: "send" });
  }
}
