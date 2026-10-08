// Date, time and size formatting matching Fireflies' wording ("Jul 28 · 5:28 PM · 10 min").

/** Backend datetimes are naive UTC ("2026-10-08T09:30:00"); treat them as UTC. */
export function parseDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** 754000 -> "12:34", 3_723_000 -> "1:02:03" */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Duration label: "45 sec", "12 min", "1 hr 5 min" */
export function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return mins % 60 ? `${h} hr ${mins % 60} min` : `${h} hr`;
}

export const formatTime = (d: string) =>
  parseDate(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** "Jul 28" (adds the year when it isn't the current one). */
export function formatShortDate(d: string): string {
  const date = parseDate(d);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** Home "Recent" rows: "Thu, Aug 8 2024, 3:52 PM" */
export function formatRecentDate(d: string): string {
  const date = parseDate(d);
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return `${day} ${date.getFullYear()}, ${formatTime(d)}`;
}

/** Day-group header: "Tue, Jul 28" */
export const formatDayHeader = (d: string) =>
  parseDate(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Notepad meta line: "Jul 20 2026, 4:51 PM" */
export function formatLongDate(d: string): string {
  const date = parseDate(d);
  const day = date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).replace(",", "");
  return `${day}, ${formatTime(d)}`;
}

export function dayKey(d: string): string {
  const date = parseDate(d);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

export const firstName = (name: string) => name.split(/\s+/)[0] ?? name;

/** ISO date (yyyy-mm-dd) n days ago, in local time. */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toLocaleDateString("en-CA");
}
