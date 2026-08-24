const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/allie@merciertalentsolutions.com";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);
const MIN_FORM_AGE_MS = 1500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const textValue = (formData, name, maxLength = 10000) => {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
};

const safeReturnPath = (value) => {
  const path = String(value || "").trim();
  return /^\/careers\/[a-z0-9-]+\/$/.test(path) ? path : "/careers/";
};

const redirectBack = (request, returnPath, params) => {
  const url = new URL(returnPath, request.url);
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

const fileExtension = (name) => {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
};

const isAllowedDocument = (file) => {
  if (!(file instanceof File) || !file.name || file.size <= 0) return false;
  if (file.size > MAX_ATTACHMENT_BYTES) return false;

  const extension = fileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.has(extension)) return false;

  const type = String(file.type || "").toLowerCase();
  return !type || ALLOWED_TYPES.has(type);
};

const hasFile = (file) =>
  file instanceof File && Boolean(file.name) && file.size > 0;

const looksLikeHumanName = (value) =>
  Boolean(value) && value.length <= 120 && NAME_PATTERN.test(value);

const hasPlausibleFormTiming = (value) => {
  const startedAt = Number(value);
  if (!Number.isFinite(startedAt) || startedAt <= 0) return false;

  const age = Date.now() - startedAt;
  return age >= MIN_FORM_AGE_MS && age <= MAX_FORM_AGE_MS;
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const returnPath = safeReturnPath(textValue(formData, "return_to", 200));

    if (
      textValue(formData, "_honey", 200) ||
      textValue(formData, "company_website", 500)
    ) {
      return redirectBack(request, returnPath, { sent: "1" });
    }

    const name = textValue(formData, "name", 160);
    const email = textValue(formData, "email", 254);
    const message = textValue(formData, "message", 10000);
    const position = textValue(formData, "position", 240);
    const token = textValue(formData, "cf-turnstile-response", 2048);
    const formStartedAt = textValue(formData, "form_started_at", 40);
    const resume = formData.get("attachment");
    const additionalMaterials = formData.get("additional_materials");
    const hasAdditionalMaterials = hasFile(additionalMaterials);

    if (
      !looksLikeHumanName(name) ||
      !EMAIL_PATTERN.test(email) ||
      !position ||
      !token ||
      !hasPlausibleFormTiming(formStartedAt)
    ) {
      return redirectBack(request, returnPath, { error: "verification" });
    }

    if (!isAllowedDocument(resume)) {
      return redirectBack(request, returnPath, { error: "resume" });
    }

    if (hasAdditionalMaterials && !isAllowedDocument(additionalMaterials)) {
      return redirectBack(request, returnPath, { error: "resume" });
    }

    const totalAttachmentBytes =
      resume.size + (hasAdditionalMaterials ? additionalMaterials.size : 0);

    if (totalAttachmentBytes > MAX_ATTACHMENT_BYTES) {
      return redirectBack(request, returnPath, { error: "resume" });
    }

    if (!env.TURNSTILE_SECRET_KEY) {
      console.error("TURNSTILE_SECRET_KEY is not configured.");
      return redirectBack(request, returnPath, { error: "send" });
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
      console.error("Turnstile verification request failed for Careers.");
      return redirectBack(request, returnPath, { error: "verification" });
    }

    const verification = await verificationResponse.json();
    const requestHostname = new URL(request.url).hostname;

    if (
      !verification.success ||
      verification.action !== "career" ||
      verification.hostname !== requestHostname
    ) {
      console.warn("Turnstile rejected Careers submission.", {
        hostname: verification.hostname,
        action: verification.action,
        errors: verification["error-codes"],
      });
      return redirectBack(request, returnPath, { error: "verification" });
    }

    const delivery = new FormData();
    delivery.append("_subject", `Career Application — ${position}`);
    delivery.append("_template", "table");
    delivery.append("_captcha", "false");
    delivery.append("_cc", "julia@merciertalentsolutions.com");
    delivery.append("_replyto", email);
    delivery.append("form_name", "Career Application");
    delivery.append("position", position);
    delivery.append("name", name);
    delivery.append("email", email);
    delivery.append("message", message);
    delivery.append("attachment", resume, resume.name);

    if (hasAdditionalMaterials) {
      delivery.append(
        "additional_materials",
        additionalMaterials,
        additionalMaterials.name,
      );
    }

    const deliveryResponse = await fetch(FORMSUBMIT_ENDPOINT, {
      method: "POST",
      body: delivery,
      redirect: "follow",
    });

    if (!deliveryResponse.ok) {
      console.error("Career application delivery failed.", {
        status: deliveryResponse.status,
      });
      return redirectBack(request, returnPath, { error: "send" });
    }

    return redirectBack(request, returnPath, { sent: "1" });
  } catch (error) {
    console.error("Career application submission failed.", error);
    return redirectBack(request, "/careers/", { error: "send" });
  }
}
