import { useState } from "react";
import { Check, FileText, Link2, RotateCcw, Sparkles, X } from "lucide-react";
import { partyTypeLabel, roleLabel } from "../../labels.js";
import {
	useDeleteParty,
	useDraftRequest,
	usePortalRealtime,
	useReissueLink,
	useSendRequest,
	type CaseDocument,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { usePortalSuggestions, type PortalRequestItem } from "../../hooks/useCreatePortalLink.js";

type ThreadItem = PartyView["thread"][number];

/** Center pane: a chat-first view of the selected party. The composer is the
 * one place everything happens — suggested follow-ups are tap-to-add pills
 * directly above the message input; selecting them + Send issues a request. */
export function PartyDetail({
	caseId,
	party,
	uploadedFiles,
	onRemoved,
}: {
	caseId: string;
	party: PartyView;
	uploadedFiles: string[];
	caseDocuments: CaseDocument[];
	onRemoved?: () => void;
}) {
	const [msg, setMsg] = useState("");
	const [copied, setCopied] = useState(false);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const del = useDeleteParty(caseId);
	const reissue = useReissueLink(caseId);
	const send = useSendRequest(caseId);
	const draft = useDraftRequest(caseId);
	const suggestions = usePortalSuggestions(caseId);
	const sugg: PortalRequestItem[] = suggestions.data ?? [];
	const { borrowerTyping, sendTyping } = usePortalRealtime(caseId);

	function selectedItems(): PortalRequestItem[] {
		return sugg.filter((_, i) => selected.has(i));
	}

	function partyContext(): string {
		const who = [party.display_name, party.role ? `role: ${roleLabel(party.role)}` : ""].filter(Boolean).join(", ");
		const docs = (party.documents ?? []).map((d) => `${roleLabel(d.role)} on ${d.label}`).join("; ");
		return [who && `Borrower: ${who}`, docs && `Appears on: ${docs}`].filter(Boolean).join(". ");
	}

	async function generate() {
		const text = await draft.mutateAsync({ items: selectedItems(), context: partyContext() });
		setMsg(text); // editable draft — operator reviews/edits before sending
	}

	const canSend = selectedItems().length > 0 || msg.trim().length > 0;

	async function sendMessage() {
		if (!canSend) return;
		await send.mutateAsync({ party_id: party.party_id, items: selectedItems(), message: msg.trim() || null });
		setMsg("");
		setSelected(new Set());
	}

	const portalUrl = party.portal_token
		? `${typeof window !== "undefined" ? window.location.origin : ""}/portal?token=${party.portal_token}`
		: null;

	async function copyLink() {
		if (!portalUrl) return;
		try {
			await navigator.clipboard.writeText(portalUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}

	function remove() {
		if (window.confirm(`Remove ${party.display_name || "this party"} from the portal?`)) {
			del.mutate(party.party_id, { onSuccess: () => onRemoved?.() });
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Compact header */}
			<header className="border-b border-slate-200 px-5 py-3 flex items-center gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-semibold text-slate-900 truncate">{party.display_name || roleLabel(party.role)}</h2>
					<p className="text-xs text-slate-500 truncate">
						{[roleLabel(party.role), partyTypeLabel(party.party_type)].filter(Boolean).join(" · ")}
						{party.verified && <span className="text-green-600"> · ✓ Verified</span>}
						{party.signed && <span className="text-green-600"> · ✓ Signed</span>}
						{party.email && <span> · {party.email}</span>}
						{!party.has_account && <span className="text-slate-400"> · No account</span>}
					</p>
					{party.documents.length > 0 && (
						<div className="flex flex-wrap gap-1 mt-1">
							{party.documents.map((d) => (
								<span key={d.doc_id} className="text-[10px] bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">
									{roleLabel(d.role)} · {d.label}
								</span>
							))}
						</div>
					)}
				</div>
				{party.access_code && (
					<button
						type="button"
						onClick={() => reissue.mutate(party.party_id)}
						disabled={reissue.isPending}
						title="Reset access code"
						aria-label="Reset access code"
						className="shrink-0 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-50 flex items-center justify-center"
					>
						<RotateCcw size={16} />
					</button>
				)}
				{party.access_code && (
					<div className="shrink-0 text-right">
						<p className="text-[10px] uppercase tracking-wide text-slate-400">Access code</p>
						<p className="font-mono font-semibold text-slate-800 tracking-widest">{party.access_code}</p>
					</div>
				)}
				{portalUrl && (
					<button
						type="button"
						onClick={copyLink}
						title={copied ? "Copied!" : "Copy portal link"}
						aria-label="Copy portal link"
						className="shrink-0 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-base flex items-center justify-center"
					>
						{copied ? <Check size={16} /> : <Link2 size={16} />}
					</button>
				)}
				<button type="button" onClick={remove} disabled={del.isPending} title="Remove" aria-label="Remove" className="shrink-0 h-9 w-9 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-50"><X size={16} /></button>
			</header>

			{/* Conversation — the main area */}
			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-slate-50">
				{party.thread.length === 0 && !borrowerTyping ? (
					<div className="max-w-md mx-auto mt-6 bg-white border border-slate-200 rounded-xl p-5 text-center space-y-3">
						<p className="text-sm font-medium text-slate-800">Start the conversation</p>
						<p className="text-xs text-slate-500">
							Send {party.display_name || "them"} the link below and their access code. Once they
							open it, all your messages and document requests happen right here.
						</p>
						{portalUrl && (
							<div className="flex items-center gap-2">
								<input readOnly value={portalUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono" />
								<button type="button" onClick={copyLink} className="rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-xs px-3 py-1.5">{copied ? "Copied" : "Copy"}</button>
							</div>
						)}
						{party.access_code && (
							<p className="text-xs text-slate-500">Access code: <span className="font-mono font-semibold text-slate-800 tracking-widest">{party.access_code}</span></p>
						)}
						{!portalUrl && <p className="text-xs text-amber-600">Link not ready — link this party to a case identity first.</p>}
					</div>
				) : (
					party.thread.map((m) => <OpBubble key={m.message_id} m={m} />)
				)}
				{borrowerTyping && (
					<div className="flex justify-start">
						<div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex gap-1">
							<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
							<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
							<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
						</div>
					</div>
				)}
			</div>

			{/* Collapsible shared documents */}
			{uploadedFiles.length > 0 && (
				<details className="border-t border-slate-200 px-5 py-2 group">
					<summary className="text-sm font-medium text-slate-600 cursor-pointer flex items-center justify-between">
						<span>Shared documents</span>
						<span className="text-xs text-slate-400">{uploadedFiles.length}</span>
					</summary>
					<ul className="mt-3 space-y-0.5">
						{uploadedFiles.map((f, i) => (
							<li key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="text-green-600" aria-hidden>✓</span>{f}</li>
						))}
					</ul>
				</details>
			)}

			{/* Composer — suggestion pills sit directly above the message input */}
			<div className="border-t border-slate-200 px-4 py-3 space-y-2">
				{sugg.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{sugg.map((item, i) => {
							const on = selected.has(i);
							return (
								<button
									key={i}
									type="button"
									title={item.detail || item.title}
									onClick={() =>
										setSelected((prev) => {
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
				)}
				<div className="flex items-end gap-2">
					<button
						type="button"
						onClick={generate}
						disabled={draft.isPending || !canSend}
						title="Draft a message with AI"
						aria-label="Draft with AI"
						className="shrink-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-40 flex items-center justify-center"
					>
						<Sparkles size={18} />
					</button>
					<textarea
						value={msg}
						onChange={(e) => { setMsg(e.target.value); sendTyping(); }}
						onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
						rows={1}
						placeholder={selected.size ? `${selected.size} selected — add a note…` : "Message…"}
						className="flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm max-h-32"
					/>
					<button
						type="button"
						onClick={sendMessage}
						disabled={send.isPending || !canSend}
						className="shrink-0 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4"
					>
						{send.isPending ? "…" : "Send"}
					</button>
				</div>
			</div>
		</div>
	);
}

/** Operator-perspective chat bubble — "You" (operator) right, borrower left. */
function OpBubble({ m }: { m: ThreadItem }) {
	const mine = m.author_kind === "operator";
	const items = (m.items ?? []) as Array<{ title?: string }>;
	const align = mine ? "justify-end" : "justify-start";
	if (m.kind === "upload") {
		return (
			<div className={`flex ${align}`}>
				<div className={`flex items-center gap-2 max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
					<FileText size={14} />{m.body}
				</div>
			</div>
		);
	}
	return (
		<div className={`flex ${align}`}>
			<div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
				<p className="text-[10px] opacity-70 mb-0.5">{mine ? "You" : "Borrower"}</p>
				{m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
				{items.length > 0 && (
					<ul className={`mt-1 ml-4 list-disc ${mine ? "text-indigo-100" : "text-slate-600"}`}>
						{items.map((it, i) => <li key={i}>{it.title}</li>)}
					</ul>
				)}
			</div>
		</div>
	);
}
