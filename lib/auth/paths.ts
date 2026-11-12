/** Routes anyone may open: login, email links (they carry their own signed token), and secret-protected engine routes. */
const PUBLIC_PREFIXES = ["/login", "/r/", "/outcome/", "/api/outcome", "/api/run/", "/_next/", "/favicon"];

export function isProtectedPath(path: string): boolean {
  return !PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}
