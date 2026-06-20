import { statusLabel } from "../../labels.js";
import type { ThreadMessage } from "../../hooks/usePartyHub.js";

/** The two-way conversation with a party — operator requests + borrower replies. */
export function PortalThread({ thread }: { thread: ThreadMessage[] }) {
	if (thread.length === 0) {
		return <p className="text-sm text-slate-400">No messages yet.</p>;
	}
	return (
		<ul className="space-y-2">
			{thread.map((m) => {
				const fromOperator = m.author_kind === "operator";
				const items = (m.items ?? []) as Array<{ title?: string }>;
				return (
					<li key={m.message_id} className={`rounded-lg p-3 ${fromOperator ? "bg-indigo-50" : "bg-slate-50"}`}>
						<div className="flex items-center justify-between text-xs text-slate-400 mb-1">
							<span>{fromOperator ? "You" : "Borrower"}</span>
							{m.status && <span>{statusLabel(m.status)}</span>}
						</div>
						{m.body && <p className="text-sm text-slate-700">{m.body}</p>}
						{items.length > 0 && (
							<ul className="mt-1 ml-4 list-disc text-sm text-slate-600">
								{items.map((it, i) => (
									<li key={i}>{it.title}</li>
								))}
							</ul>
						)}
					</li>
				);
			})}
		</ul>
	);
}
