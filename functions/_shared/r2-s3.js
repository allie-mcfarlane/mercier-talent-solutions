import { AwsClient } from "aws4fetch";

const DEFAULT_BUCKET = "mercier-website-media";

const awsEncode = (value) => encodeURIComponent(String(value))
  .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const encodePath = (value) => String(value || "")
  .split("/")
  .map(awsEncode)
  .join("/");

const config = (env) => {
  const accountId = String(env?.R2_ACCOUNT_ID || "").trim();
  const accessKeyId = String(env?.R2_ACCESS_KEY_ID || "").trim();
  const secretAccessKey = String(env?.R2_SECRET_ACCESS_KEY || "").trim();
  const bucket = String(env?.R2_BUCKET_NAME || DEFAULT_BUCKET).trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  };
};

export const hasR2S3 = (env) => Boolean(config(env));

const clientFor = (env) => {
  const cfg = config(env);
  if (!cfg) throw new Error("R2 S3 credentials are not configured.");
  return {
    cfg,
    client: new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: "s3",
      region: "auto",
    }),
  };
};

const objectUrl = (cfg, key = "", query = {}) => {
  const base = `${cfg.endpoint}/${awsEncode(cfg.bucket)}${key ? `/${encodePath(key)}` : ""}`;
  const url = new URL(base);
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
  }
  return url.toString();
};

const signedFetch = async (env, { method = "GET", key = "", query = {}, body, headers = {} } = {}) => {
  const { cfg, client } = clientFor(env);
  const url = objectUrl(cfg, key, query);
  return client.fetch(url, {
    method,
    headers,
    ...(body === undefined || method === "GET" || method === "HEAD" ? {} : { body }),
  });
};

const decodeXml = (value = "") => String(value)
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'")
  .replaceAll("&amp;", "&");

const xmlValue = (block, tag) => {
  const match = String(block || "").match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return match ? decodeXml(match[1]) : "";
};

export async function r2List(env, prefix = "", limit = 500) {
  const response = await signedFetch(env, {
    method: "GET",
    query: {
      "list-type": "2",
      prefix,
      "max-keys": Math.min(Math.max(Number(limit) || 500, 1), 1000),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const code = xmlValue(text, "Code");
    throw new Error(`R2 list failed (${response.status}${code ? ` ${code}` : ""}).`);
  }
  const xml = await response.text();
  return [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map((match) => ({
    key: xmlValue(match[1], "Key"),
    size: Number(xmlValue(match[1], "Size") || 0),
    uploaded: xmlValue(match[1], "LastModified") || null,
    etag: xmlValue(match[1], "ETag").replace(/^"|"$/g, ""),
  }));
}

export async function r2Get(env, key) {
  return signedFetch(env, { method: "GET", key });
}

export async function r2Put(env, key, body, { contentType = "application/octet-stream", cacheControl = "public, max-age=0, must-revalidate" } = {}) {
  return signedFetch(env, {
    method: "PUT",
    key,
    body,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": cacheControl,
    },
  });
}

export async function r2Delete(env, key) {
  return signedFetch(env, { method: "DELETE", key });
}

export async function r2ErrorDetails(response) {
  if (!response || response.ok) return "";
  const text = await response.clone().text().catch(() => "");
  const code = xmlValue(text, "Code");
  const message = xmlValue(text, "Message");
  return [code, message].filter(Boolean).join(": ");
}
