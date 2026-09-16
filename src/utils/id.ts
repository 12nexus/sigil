/** Short, sortable, collision-resistant ids. */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand =
    typeof crypto !== "undefined" && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(36).padStart(2, "0"))
          .join("")
          .slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${time}${rand}`;
}

/** URL-safe token for the client presentation link. */
export function newShareToken(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
