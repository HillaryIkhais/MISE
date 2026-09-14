export function cn(...classes: (string | false | null | undefined | Record<string, boolean>)[]): string {
  const flat: string[] = [];
  for (const c of classes) {
    if (!c) continue;
    if (typeof c === "string") {
      flat.push(c);
    } else if (typeof c === "object") {
      for (const [key, val] of Object.entries(c)) {
        if (val) flat.push(key);
      }
    }
  }
  return flat.join(" ");
}

export function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function humanize(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function truncate(s: string, len: number): string {
  return s.length > len ? s.slice(0, len) + "…" : s;
}
