export function safeAuthReturnTo(value: string | null, requestUrl: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) {
    return "/";
  }

  try {
    const origin = new URL(requestUrl);
    const target = new URL(value, origin);
    if (target.origin !== origin.origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
