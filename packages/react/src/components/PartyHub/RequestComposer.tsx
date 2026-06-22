import { useState } from "react";
import { Sparkles } from "lucide-react";
import {
	usePortalSuggestions,
	type PortalRequestItem,
} from "../../hooks/useCreatePortalLink.js";
import { roleLabel } from "../../labels.js";
import { useDraftRequest, useSendRequest, type PartyView } from "../../hooks/usePartyHub.js";

export interface RequestComposerProps {
	caseId: string;
	party: PartyView;
	onSent?: () => void;
	onCancel?: () => void;
}

/**
 * Compose a document/text request to a party: pick veritas-suggested items,
 * add custom ones, optionally AI-draft a borrower-friendly message that the
 * operator EDITS before sending (never auto-sent), then send to the party's
 * thread (reuses their persistent link).
 */
export function RequestComposer({ caseId, party, onSent, onCancel }: RequestComposerProps) {
	const suggestions = usePortalSuggestions(caseId);
	const draft = useDraftRequest(caseId);
	const send = useSendRequest(caseId);

	const items: PortalRequestItem[] = suggestions.data ?? [];
	const [checked, setChecked] = useState<Set<number>>(new Set());
	const [custom, setCustom] = useState<string[]>([]);
	const [draftItem, setDraftItem] = useState("");
	const [message, setMessage] = useState("");

	function selectedItems(): PortalRequestItem[] {
		const all: PortalRequestItem[] = [
			...items.filter((_, i) => checked.has(i)),
			...custom.map((title) => ({ id: "", title, detail: "", action: "", source: "custom", priority: "medium" })),
		];
		// Include whatever's typed in "Add your own" but not yet added as a chip.
		const pending = draftItem.trim();
		if (pending) all.push({ id: "", title: pending, detail: "", action: "", source: "custom", priority: "medium" });
		return all;
	}

	function partyContext(): string {
		const who = [party.display_name, party.role ? `role: ${roleLabel(party.role)}` : ""].filter(Boolean).join(", ");
		const docs = (party.documents ?? []).map((d) => `${roleLabel(d.role)} on ${d.label}`).join("; ");
		return [who && `Borrower: ${who}`, docs && `Appears on: ${docs}`].filter(Boolean).join(". ");
	}

	async function generate() {
		const text = await draft.mutateAsync({ items: selectedItems(), context: partyContext() });
		setMessage(text); // editable draft — operator reviews/edits before sending
	}

	async function submit() {
		await send.mutateAsync({
			party_id: party.party_id,
			items: selectedItems(),
			message: message.trim() || null,
		});
		onSent?.();
	}

	const canSend = selectedItems().length > 0 || message.trim().length > 0;

	const title = party.display_name || "this borrower";

	return (
		<div className="space-y-4 border-t border-slate-200 pt-4">
			<h3 className="text-sm font-semibold text-slate-800">Request from {title}</h3>

			{items.length > 0 && (
				<div>
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Suggested follow-ups</p>
					<div className="flex flex-wrap gap-1.5">
						{items.map((item, i) => {
							const on = checked.has(i);
							return (
								<button
									key={i}
									type="button"
									title={item.detail || item.title}
									onClick={() =>
										setChecked((prev) => {
											const next = new Set(prev);
											next.has(i) ? next.delete(i) : next.add(i);
											return next;
										})
									}
									className={`text-xs rounded-full px-3 py-1 border transition ${
										on
											? "bg-indigo-600 border-indigo-600 text-white"
											: "bg-white border-slate-300 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"
									}`}
								>
									{on ? "✓ " : "+ "}
									{item.title}
								</button>
							);
						})}
					</div>
				</div>
			)}

			<div>
				<label className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5 block">Add a custom request</label>
				<input
					value={draftItem}
					onChange={(e) => setDraftItem(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && draftItem.trim()) {
							e.preventDefault();
							setCustom((c) => [...c, draftItem.trim()]);
							setDraftItem("");
						}
					}}
					placeholder="Add your own item"
					className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>
			{custom.length > 0 && (
				<ul className="space-y-1 text-sm text-slate-700">
					{custom.map((c, i) => (
						<li key={i} className="flex items-center justify-between bg-slate-50 rounded px-3 py-1.5">
							{c}
							<button type="button" onClick={() => setCustom((cs) => cs.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">×</button>
						</li>
					))}
				</ul>
			)}

			<div>
				<div className="flex items-center justify-between mb-1">
					<label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Message</label>
					<button
						type="button"
						onClick={generate}
						disabled={draft.isPending}
						className="text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
					>
						{draft.isPending ? "Drafting…" : <span className="inline-flex items-center gap-1"><Sparkles size={12} /> Draft with AI</span>}
					</button>
				</div>
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					rows={3}
					placeholder="Write a note, or draft one with AI and edit it."
					className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
				/>
			</div>

			{send.error && <p className="text-sm text-red-600">{send.error.message}</p>}

			<div className="flex gap-2">
				<button
					type="button"
					onClick={submit}
					disabled={send.isPending || !canSend}
					className="flex-1 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium py-2.5"
				>
					{send.isPending ? "Sending…" : "Send request"}
				</button>
				{onCancel && (
					<button type="button" onClick={onCancel} className="rounded-full px-4 text-sm text-slate-500 hover:text-slate-700">
						Cancel
					</button>
				)}
			</div>
		</div>
	);
}
