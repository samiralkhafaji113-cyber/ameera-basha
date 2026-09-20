/** Post-login redirect target: same-site admin paths only – never an open redirect. */
export function safeNext(raw: unknown): string {
  return typeof raw === "string" &&
    raw.length <= 300 &&
    /^\/admin(\/[A-Za-z0-9\-_/.]*)?(\?[A-Za-z0-9\-_.=&%]*)?$/.test(raw) &&
    !raw.includes("//") &&
    !raw.includes("..")
    ? raw
    : "/admin";
}
