import clsx, { type ClassValue } from "clsx";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Escape a user string for use inside a RegExp. */
export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Split text into parts, flagging case-insensitive matches of `query`. */
export function splitMatches(text: string, query: string): { text: string; match: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  return text
    .split(new RegExp(`(${escapeRegExp(q)})`, "gi"))
    .filter(Boolean)
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }));
}

export function countMatches(text: string, query: string): number {
  const q = query.trim();
  if (!q) return 0;
  return (text.match(new RegExp(escapeRegExp(q), "gi")) ?? []).length;
}

export function downloadUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
