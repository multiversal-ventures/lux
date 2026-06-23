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
