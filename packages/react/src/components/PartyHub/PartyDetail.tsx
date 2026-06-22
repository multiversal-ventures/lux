import { useState } from "react";
import { Check, ClipboardList, FileText, Link2, RotateCcw, X } from "lucide-react";
import { partyTypeLabel, roleLabel } from "../../labels.js";
import {
	useAttachDocument,
	useDeleteParty,
	usePortalRealtime,
	useReissueLink,
	useSendRequest,
	type CaseDocument,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { RequestComposer } from "./RequestComposer.js";

type ThreadItem = PartyView["thread"][number];

/** Center pane: a chat-first view of the selected party — conversation up front,
 * link behind an icon, documents/roles tucked into a collapsible panel. */
export function PartyDetail({
	caseId,
	party,
	uploadedFiles,
	caseDocuments,
	onRemoved,
}: {
	caseId: string;
	party: PartyView;
	uploadedFiles: string[];
	caseDocuments: CaseDocument[];
	onRemoved?: () => void;
}) {
	const [composing, setComposing] = useState(false);
	const [copied, setCopied] = useState(false);
	const [msg, setMsg] = useState("");
	const del = useDeleteParty(caseId);
	const reissue = useReissueLink(caseId);
	const send = useSendRequest(caseId);
	const { borrowerTyping, sendTyping } = usePortalRealtime(caseId);

	async function sendMessage() {
		const text = msg.trim();
		if (!text) return;
		await send.mutateAsync({ party_id: party.party_id, items: [], message: text });
		setMsg("");
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

			{/* Collapsible documents & roles */}
			<details className="border-t border-slate-200 px-5 py-2 group">
				<summary className="text-sm font-medium text-slate-600 cursor-pointer flex items-center justify-between">
					<span>Documents &amp; roles</span>
					<span className="text-xs text-slate-400">{party.documents.length + uploadedFiles.length}</span>
				</summary>
				<div className="mt-3 space-y-3">
					<DocRoles party={party} caseDocuments={caseDocuments} caseId={caseId} />
					{uploadedFiles.length > 0 && (
						<div>
							<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Shared documents</p>
							<ul className="space-y-0.5">
								{uploadedFiles.map((f, i) => (
									<li key={i} className="flex items-center gap-2 text-sm text-slate-700"><span className="text-green-600" aria-hidden>✓</span>{f}</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</details>

			{/* Composer — chat message + structured request */}
			<div className="border-t border-slate-200 px-4 py-3">
				{composing ? (
					<RequestComposer caseId={caseId} party={party} onSent={() => setComposing(false)} onCancel={() => setComposing(false)} />
				) : (
					<div className="flex items-end gap-2">
						<button
							type="button"
							onClick={() => setComposing(true)}
							title="Request documents"
							aria-label="Request documents"
							className="shrink-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 text-lg disabled:opacity-40"
						>
							<ClipboardList size={18} />
						</button>
						<textarea
							value={msg}
							onChange={(e) => { setMsg(e.target.value); sendTyping(); }}
							onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
							rows={1}
							placeholder="Message…"
							className="flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm max-h-32 disabled:opacity-50"
						/>
						<button
							type="button"
							onClick={sendMessage}
							disabled={send.isPending || !msg.trim()}
							className="shrink-0 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4"
						>
							Send
						</button>
					</div>
				)}
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

/** Role-on-documents — existing relations + a compact assign control. */
function DocRoles({ party, caseDocuments, caseId }: { party: PartyView; caseDocuments: CaseDocument[]; caseId: string }) {
	const attach = useAttachDocument(caseId);
	const [docId, setDocId] = useState("");
	const [docRole, setDocRole] = useState(party.role || "borrower");

	return (
		<div>
			<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Role on documents</p>
			{party.documents.length > 0 ? (
				<ul className="space-y-0.5 mb-2">
					{party.documents.map((d) => (
						<li key={d.doc_id} className="text-sm text-slate-700"><span className="font-medium">{roleLabel(d.role)}</span> on {d.label}</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-slate-400 mb-2">Not assigned to any document.</p>
			)}
			{caseDocuments.length > 0 && (
				<div className="flex flex-wrap gap-2 items-center">
					<select value={docId} onChange={(e) => setDocId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
						<option value="">Choose a document…</option>
						{caseDocuments.map((d) => <option key={d.doc_id} value={d.doc_id}>{d.label}</option>)}
					</select>
					<input value={docRole} onChange={(e) => setDocRole(e.target.value)} placeholder="role" className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
					<button type="button" onClick={() => docId && docRole.trim() && attach.mutate({ partyId: party.party_id, docId, role: docRole.trim() })} disabled={!docId || !docRole.trim() || attach.isPending} className="rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm px-3 py-1.5">Assign</button>
				</div>
			)}
		</div>
	);
}
