const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const hasAccessCookie = (cookieHeader) =>
  /(?:^|;\s*)CF_Authorization=/.test(String(cookieHeader || ""));

export async function getAccessEmail(request) {
  const direct = normalizeEmail(request.headers.get("cf-access-authenticated-user-email"));
  if (direct) return direct;

  const cookieHeader = request.headers.get("cookie") || "";
  const assertion = request.headers.get("cf-access-jwt-assertion") || "";
  const identityCookie = hasAccessCookie(cookieHeader)
    ? cookieHeader
    : assertion
      ? `CF_Authorization=${assertion}`
      : "";

  if (!identityCookie) return "";

  try {
    const identityUrl = new URL("/cdn-cgi/access/get-identity", request.url);
    const response = await fetch(identityUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: identityCookie,
      },
      redirect: "manual",
    });

    if (!response.ok) return "";
    const identity = await response.json().catch(() => null);
    return normalizeEmail(identity?.email);
  } catch {
    return "";
  }
}
