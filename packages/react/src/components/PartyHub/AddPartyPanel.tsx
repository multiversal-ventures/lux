import { useState } from "react";
import { roleLabel } from "../../labels.js";
import {
	useAddParty,
	useAttachDocument,
	type CaseDocument,
	type PartyCandidate,
} from "../../hooks/usePartyHub.js";

/**
 * Email-"To:"-style party add: type a name to pick a known person from the case
 * or add a new one. Adding new asks which documents they appear on — confirming
 * that strengthens identity matching (and pre-fills their role on those docs).
 */
export function AddPartyPanel({
	caseId,
	candidates,
	caseDocuments,
}: {
	caseId: string;
	candidates: PartyCandidate[];
	caseDocuments: CaseDocument[];
}) {
	const addParty = useAddParty(caseId);
	const attach = useAttachDocument(caseId);

	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<{ name: string; role: string; docIds: Set<string> } | null>(null);

	const q = query.trim().toLowerCase();
	const matches = candidates.filter((c) => (c.display_name ?? roleLabel(c.role)).toLowerCase().includes(q));

	function pickCandidate(c: PartyCandidate) {
		addParty.mutate({
			party_type: c.party_type ?? "individual",
			role: c.role ?? null,
			display_name: c.display_name ?? null,
			linked_identity_id: c.identity_id ?? null,
		});
		setQuery("");
		setOpen(false);
	}

	function startNew() {
		setDraft({ name: query.trim(), role: "borrower", docIds: new Set() });
		setOpen(false);
	}

	async function createNew() {
		if (!draft) return;
		const created = await addParty.mutateAsync({
			party_type: "individual", display_name: draft.name, role: draft.role || null, linked_identity_id: null,
		});
		for (const docId of draft.docIds) {
			await attach.mutateAsync({ partyId: created.party_id, docId, role: draft.role || "borrower" });
		}
		setDraft(null);
		setQuery("");
	}

	if (draft) {
		return (
			<div className="space-y-2">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add {draft.name || "person"}</p>
				<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
				<input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Role (e.g. borrower)" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
				{caseDocuments.length > 0 && (
					<div>
						<p className="text-xs text-slate-500 mb-1">Do they appear on any of these documents? Confirming this helps us verify their identity.</p>
						<div className="space-y-1 max-h-32 overflow-y-auto">
							{caseDocuments.map((d) => (
								<label key={d.doc_id} className="flex gap-2 text-xs text-slate-700">
									<input
										type="checkbox"
										checked={draft.docIds.has(d.doc_id)}
										onChange={() => {
											const next = new Set(draft.docIds);
											next.has(d.doc_id) ? next.delete(d.doc_id) : next.add(d.doc_id);
											setDraft({ ...draft, docIds: next });
										}}
									/>
									{d.label}
								</label>
							))}
						</div>
					</div>
				)}
				<div className="flex gap-2">
					<button type="button" onClick={createNew} disabled={!draft.name.trim() || addParty.isPending} className="flex-1 rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm py-1.5">Add person</button>
					<button type="button" onClick={() => setDraft(null)} className="text-sm text-slate-500 px-2">Cancel</button>
				</div>
			</div>
		);
	}

	return (
		<div className="relative">
			<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Add a person</p>
			<input
				value={query}
				onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
				onFocus={() => setOpen(true)}
				placeholder="To: name…"
				className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
			/>
			{open && (query || matches.length > 0) && (
				<div className="absolute bottom-full mb-1 left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
					{matches.map((c) => (
						<button key={c.identity_id} type="button" onClick={() => pickCandidate(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50">
							{c.display_name || roleLabel(c.role)} <span className="text-xs text-slate-400">· {roleLabel(c.role)}</span>
						</button>
					))}
					{query.trim() && (
						<button type="button" onClick={startNew} className="w-full text-left px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 border-t border-slate-100">
							+ Add "{query.trim()}" as a new person
						</button>
					)}
				</div>
			)}
		</div>
	);
}
