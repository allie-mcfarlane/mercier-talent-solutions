const DEFAULT_BUCKET = "mercier-website-media";
const encoder = new TextEncoder();

const awsEncode = (value) => encodeURIComponent(String(value))
  .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

const encodePath = (value) => String(value || "")
  .split("/")
  .map(awsEncode)
  .join("/");

const toBytes = (value) => {
  if (value == null) return new Uint8Array();
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return encoder.encode(String(value));
};

const toHex = (buffer) => [...new Uint8Array(buffer)]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");

const sha256 = async (value) => crypto.subtle.digest("SHA-256", toBytes(value));

const hmac = async (key, value) => {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toBytes(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, toBytes(value));
};

const dateParts = (date = new Date()) => {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
};

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

const canonicalQuery = (query = {}) => Object.entries(query)
  .filter(([, value]) => value !== undefined && value !== null)
  .map(([key, value]) => [awsEncode(key), awsEncode(value)])
  .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue))
  .map(([key, value]) => `${key}=${value}`)
  .join("&");

const signedFetch = async (env, { method = "GET", key = "", query = {}, body = null, headers = {} } = {}) => {
  const cfg = config(env);
  if (!cfg) throw new Error("R2 S3 credentials are not configured.");

  const { amzDate, dateStamp } = dateParts();
  const region = "auto";
  const service = "s3";
  const payloadBytes = toBytes(body);
  const payloadHash = toHex(await sha256(payloadBytes));
  const canonicalUri = `/${awsEncode(cfg.bucket)}${key ? `/${encodePath(key)}` : ""}`;
  const queryString = canonicalQuery(query);
  const host = new URL(cfg.endpoint).host;
  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = `${method}\n${canonicalUri}\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${toHex(await sha256(canonicalRequest))}`;

  const kDate = await hmac(encoder.encode(`AWS4${cfg.secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  const requestHeaders = new Headers(headers);
  requestHeaders.set("x-amz-content-sha256", payloadHash);
  requestHeaders.set("x-amz-date", amzDate);
  requestHeaders.set(
    "Authorization",
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  );

  const url = `${cfg.endpoint}${canonicalUri}${queryString ? `?${queryString}` : ""}`;
  return fetch(url, {
    method,
    headers: requestHeaders,
    ...(method === "GET" || method === "HEAD" ? {} : { body: payloadBytes }),
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
    query: { "list-type": "2", prefix, "max-keys": Math.min(Math.max(Number(limit) || 500, 1), 1000) },
  });
  if (!response.ok) throw new Error(`R2 list failed (${response.status}).`);
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
