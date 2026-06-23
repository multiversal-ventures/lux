import { dayLabel } from "../timeAgo.js";

/**
 * WhatsApp-style centered date pill, shown between chat messages whenever the
 * calendar day changes (and before the first message). The label comes from
 * {@link dayLabel} — "Today" / "Yesterday" / "Mon, Mar 5" / "Mar 5, 2026".
 * Renders nothing for an unparseable timestamp.
 */
export function DateSeparator({ iso }: { iso: string }) {
	const label = dayLabel(iso);
	if (!label) return null;
	return (
		<div className="flex justify-center my-3">
			<span className="px-3 py-1 rounded-full bg-slate-200/70 text-slate-500 text-[11px] font-medium">
				{label}
			</span>
		</div>
	);
}
