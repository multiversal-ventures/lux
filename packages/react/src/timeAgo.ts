/**
 * Humanized relative timestamp for chat bubbles.
 *
 * Brackets (relative to now):
 *   < 60s        → "just now"
 *   < 60m        → "Nm ago"
 *   < 24h        → "Nh ago"
 *   < 48h        → "yesterday"
 *   else         → a short date, e.g. "Mar 3"
 *
 * Pure, no dependencies. An unparseable input returns "" so callers can render
 * nothing rather than a broken label.
 */
export function timeAgo(iso: string, now: Date = new Date()): string {
	const then = new Date(iso);
	const ms = then.getTime();
	if (Number.isNaN(ms)) return "";

	const diffMs = now.getTime() - ms;
	const diffSec = Math.floor(diffMs / 1000);

	// Future timestamps (clock skew) read as "just now".
	if (diffSec < 60) return "just now";

	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin}m ago`;

	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr}h ago`;

	const diffDay = Math.floor(diffHr / 24);
	if (diffDay < 2) return "yesterday";

	// Older than yesterday → a short month/day date ("Mar 3").
	return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Wall-clock time for a single chat bubble, in the viewer's locale — "2:34 PM".
 * WhatsApp-style: every bubble carries its own clock time, and date-separator
 * pills (see {@link dayLabel}) carry the day. Unparseable input → "".
 */
export function clockTime(iso: string): string {
	const ms = new Date(iso).getTime();
	if (Number.isNaN(ms)) return "";
	return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Calendar-day label for a date-separator pill, compared in LOCAL time:
 *   today        → "Today"
 *   yesterday    → "Yesterday"
 *   same year    → "Mon, Mar 5"
 *   other year   → "Mar 5, 2026"
 * Unparseable input → "".
 */
export function dayLabel(iso: string, now: Date = new Date()): string {
	const then = new Date(iso);
	if (Number.isNaN(then.getTime())) return "";

	// Compare by calendar day in local time (not by elapsed ms): a message at
	// 11:50pm and one at 12:10am are "yesterday" / "today", not "23m apart".
	const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	const dayMs = 24 * 60 * 60 * 1000;
	const diffDays = Math.round((startOf(now) - startOf(then)) / dayMs);

	if (diffDays === 0) return "Today";
	if (diffDays === 1) return "Yesterday";

	const sameYear = then.getFullYear() === now.getFullYear();
	return then.toLocaleDateString(undefined, {
		weekday: sameYear ? "short" : undefined,
		month: "short",
		day: "numeric",
		year: sameYear ? undefined : "numeric",
	});
}

/** True when two ISO timestamps fall on the same calendar day in LOCAL time. */
export function isSameDay(a: string, b: string): boolean {
	const da = new Date(a);
	const db = new Date(b);
	if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false;
	return (
		da.getFullYear() === db.getFullYear() &&
		da.getMonth() === db.getMonth() &&
		da.getDate() === db.getDate()
	);
}
