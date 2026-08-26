const FORMSUBMIT_ENDPOINT =
  "https://formsubmit.co/4a94b00665ec4a46e1489403848db166";

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_FIELDS = 40;
const ALLOWED_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream",
]);
const ALLOWED_FIELD_TYPES = new Set(["text", "textarea", "email", "file"]);
const FIELD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/;
const MIN_FORM_AGE_MS = 1500;
const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’\-]*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CAREERS_CC = "julia@merciertalentsolutions.com";

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

const jsonOk = () =>
  new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

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

const parseApplicationSchema = (raw) => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.fields)) return null;

    const seen = new Set();
    return parsed.fields
      .slice(0, MAX_FIELDS)
      .map((field) => {
        const id = String(field?.id || "").trim().toLowerCase();
        const type = String(field?.type || "text").trim().toLowerCase();
        const label = String(field?.label || "Field").trim().slice(0, 120);
        if (!FIELD_ID_PATTERN.test(id) || !ALLOWED_FIELD_TYPES.has(type) || !label) {
          return null;
        }
        if (seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          type,
          label,
          required: field?.required === true,
        };
      })
      .filter(Boolean);
  } catch {
    return null;
  }
};

const legacyFields = [
  { id: "name", type: "text", label: "Name", required: true, legacyName: "name" },
  { id: "email", type: "email", label: "Email", required: true, legacyName: "email" },
  { id: "location", type: "text", label: "Location", required: false, legacyName: "location" },
  { id: "relevant-experience", type: "textarea", label: "Relevant legal and coaching experience", required: true, legacyName: "relevant_experience" },
  { id: "programs-experience", type: "textarea", label: "Programs and leadership development experience", required: false, legacyName: "programs_experience" },
  { id: "credentials-education", type: "textarea", label: "Coaching credentials and education", required: true, legacyName: "credentials_education" },
  { id: "interest-in-mercier", type: "textarea", label: "Why Mercier Talent Solutions", required: false, legacyName: "interest_in_mercier" },
  { id: "availability-arrangements", type: "textarea", label: "Availability and preferred professional arrangement", required: false, legacyName: "availability_arrangements" },
  { id: "additional-notes", type: "textarea", label: "Anything else", required: false, legacyName: "additional_notes" },
  { id: "resume", type: "file", label: "Resume or Professional Biography", required: true, legacyName: "attachment" },
  { id: "additional-materials", type: "file", label: "Additional Materials", required: false, legacyName: "additional_materials" },
];

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

    const position = textValue(formData, "position", 240);
    const token = textValue(formData, "cf-turnstile-response", 2048);
    const formStartedAt = textValue(formData, "form_started_at", 40);
    const schemaRaw = textValue(formData, "application_schema", 24000);
    const parsedFields = parseApplicationSchema(schemaRaw);
    const dynamicSchema = Array.isArray(parsedFields);
    const fields = dynamicSchema ? parsedFields : legacyFields;

    if (!position || !token || !hasPlausibleFormTiming(formStartedAt)) {
      return redirectBack(request, returnPath, { error: "verification" });
    }

    let replyTo = "";
    let totalAttachmentBytes = 0;

    for (const field of fields) {
      const inputName = dynamicSchema
        ? `field_${field.id}`
        : field.legacyName;

      if (field.type === "file") {
        const file = formData.get(inputName);
        const present = hasFile(file);

        if (field.required && !present) {
          return redirectBack(request, returnPath, { error: "application" });
        }

        if (present) {
          if (!isAllowedDocument(file)) {
            return redirectBack(request, returnPath, { error: "attachment" });
          }
          totalAttachmentBytes += file.size;
          if (totalAttachmentBytes > MAX_ATTACHMENT_BYTES) {
            return redirectBack(request, returnPath, { error: "attachment" });
          }
        }

        continue;
      }

      const value = textValue(formData, inputName, 12000);

      if (field.required && !value) {
        return redirectBack(request, returnPath, { error: "application" });
      }

      if (field.type === "email" && value) {
        if (!EMAIL_PATTERN.test(value)) {
          return redirectBack(request, returnPath, { error: "application" });
        }
        if (!replyTo) replyTo = value;
      }

      if (field.id === "name" && value && !looksLikeHumanName(value)) {
        return redirectBack(request, returnPath, { error: "verification" });
      }
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

    const formUrl = new URL(returnPath, request.url).toString();
    const successUrl = new URL(returnPath, request.url);
    successUrl.searchParams.set("sent", "1");
    const expectedSubject = `Career Application - ${position}`;
    const submittedReplyTo = textValue(formData, "_replyto", 254);

    if (
      textValue(formData, "_subject", 300) !== expectedSubject ||
      textValue(formData, "_template", 30) !== "table" ||
      textValue(formData, "_captcha", 10) !== "false" ||
      textValue(formData, "_cc", 300) !== CAREERS_CC ||
      textValue(formData, "_url", 500) !== formUrl ||
      textValue(formData, "_next", 600) !== successUrl.toString() ||
      (replyTo && submittedReplyTo !== replyTo)
    ) {
      console.warn("Career application delivery metadata was invalid.");
      return redirectBack(request, returnPath, { error: "send" });
    }

    if ((request.headers.get("Accept") || "").includes("application/json")) {
      return jsonOk();
    }

    return new Response(null, {
      status: 307,
      headers: {
        Location: FORMSUBMIT_ENDPOINT,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Career application submission failed.", error);
    return redirectBack(request, "/careers/", { error: "send" });
  }
}
