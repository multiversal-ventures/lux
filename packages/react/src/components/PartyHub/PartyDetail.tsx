import { useEffect, useRef, useState } from "react";
import { Ban, Check, CheckCheck, Eraser, FileText, Link2, Loader2, Pencil, RefreshCw, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { partyTypeLabel, roleLabel } from "../../labels.js";
import { clockTime, isSameDay } from "../../timeAgo.js";
import { Avatar } from "../Avatar.js";
import { DateSeparator } from "../DateSeparator.js";
import { WebcamCaptureModal } from "../WebcamCaptureModal.js";
import {
	useDeleteMessage,
	useEditMessage,
	useDeleteParty,
	useClearThread,
	useDraftRequest,
	useMarkThreadRead,
	usePortalRealtime,
	useRegenerateSuggestions,
	useReissueLink,
	useSendRequest,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { useSetOfficerAvatar } from "../../hooks/useOfficerSettings.js";
import { usePortalSuggestions, type PortalRequestItem } from "../../hooks/useCreatePortalLink.js";

type ThreadItem = PartyView["thread"][number];

/** Center pane: a chat-first view of the selected party. The composer is the
 * one place everything happens — suggested follow-ups are tap-to-add pills
 * directly above the message input; selecting them + Send issues a request. */
export function PartyDetail({
	caseId,
	party,
	officerName,
	officerAvatar,
	onRemoved,
	loading = false,
}: {
	caseId: string;
	party: PartyView;
	/** Firm's loan-officer name (from the case overview) — the operator's "You" avatar. */
	officerName?: string;
	/** Firm's loan-officer avatar data URL ("" = initials). Clickable to set via webcam. */
	officerAvatar?: string;
	onRemoved?: () => void;
	/** Overview is still loading and no party is hydrated yet — show a spinner in
	 * the thread area instead of an empty void. */
	loading?: boolean;
}) {
	const [msg, setMsg] = useState("");
	const [copied, setCopied] = useState(false);
	const [webcamOpen, setWebcamOpen] = useState(false);
	const setAvatar = useSetOfficerAvatar();
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	// WhatsApp-style auto-scroll: the scroll container + a bottom sentinel. We
	// only stick to the bottom when the operator is already near it, so new
	// messages don't yank them up while they read history. `didInitialScroll`
	// makes the very first paint jump instantly; later scrolls are smooth.
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const didInitialScroll = useRef(false);
	const del = useDeleteParty(caseId);
	const reissue = useReissueLink(caseId);
	const clearThread = useClearThread(caseId);
	const send = useSendRequest(caseId);
	const draft = useDraftRequest(caseId);
	// Party-aware: suggestions are shaped by THIS party's role + the documents
	// they appear on. Passing party_id also keys the query so switching parties
	// refetches instead of showing the previous party's pills.
	const suggestions = usePortalSuggestions(caseId, party.party_id);
	const regen = useRegenerateSuggestions(caseId);
	// Regenerate REPLACES the shown suggestions with the freshly returned set;
	// null = show the originally curated suggestions.
	const [override, setOverride] = useState<PortalRequestItem[] | null>(null);
	// Track that an explicit regenerate has run, so the "no suggestions" note only
	// appears after the operator hit the arrow — never on first load.
	const [regenerated, setRegenerated] = useState(false);
	// Operator's own custom request items (added via "+ Add your own").
	const [custom, setCustom] = useState<string[]>([]);
	const [customInput, setCustomInput] = useState("");
	const [addingOwn, setAddingOwn] = useState(false);
	const sugg: PortalRequestItem[] = override ?? (suggestions.data ?? []);
	const { borrowerTyping, sendTyping } = usePortalRealtime(caseId);
	const markRead = useMarkThreadRead(caseId);
	const deleteMessage = useDeleteMessage(caseId);
	const editMessage = useEditMessage(caseId);

	// When the operator is viewing a party that has borrower messages, mark them
	// read → the borrower's receipt flips to ✓✓. Fires on open (party switch) and
	// whenever new borrower messages arrive (thread length grows). The endpoint is
	// idempotent, so re-firing with nothing unread is a cheap no-op.
	const hasBorrowerMessages = party.thread.some((m) => m.author_kind === "borrower");
	useEffect(() => {
		if (hasBorrowerMessages) markRead.mutate(party.party_id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [party.party_id, party.thread.length]);

	// Auto-grow the composer with its content, then scroll past the cap (160px).
	useEffect(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
	}, [msg]);

	// Auto-scroll to the newest message on first load and whenever the thread
	// grows — but only if the operator is already near the bottom (within 120px),
	// so we never yank them away from older history they're reading.
	const threadLen = party.thread.length;
	useEffect(() => {
		const el = scrollRef.current;
		const bottom = bottomRef.current;
		if (!el || !bottom) return;
		const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
		const nearBottom = distanceFromBottom < 120;
		if (!didInitialScroll.current) {
			didInitialScroll.current = true;
			bottom.scrollIntoView({ behavior: "auto", block: "end" });
		} else if (nearBottom) {
			bottom.scrollIntoView({ behavior: "smooth", block: "end" });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [threadLen]);

	// Switching parties must not carry over the previous party's pills/selection:
	// the suggestions are per-person (role + their documents). Reset the local
	// override/selection/custom state so stale state doesn't bleed across parties.
	useEffect(() => {
		setOverride(null);
		setSelected(new Set());
		setCustom([]);
		setRegenerated(false);
	}, [party.party_id]);

	function selectedItems(): PortalRequestItem[] {
		const picked = sugg.filter((_, i) => selected.has(i));
		const own: PortalRequestItem[] = custom.map((title) => ({ id: "", title, detail: "", action: "", source: "custom", priority: "medium" }));
		return [...picked, ...own];
	}

	function addOwn() {
		const t = customInput.trim();
		if (!t) return;
		setCustom((c) => [...c, t]);
		setCustomInput("");
	}

	function partyContext(): string {
		const who = [party.display_name, party.role ? `role: ${roleLabel(party.role)}` : ""].filter(Boolean).join(", ");
		const docs = (party.documents ?? []).map((d) => `${roleLabel(d.role)} on ${d.label}`).join("; ");
		return [who && `Borrower: ${who}`, docs && `Appears on: ${docs}`].filter(Boolean).join(". ");
	}

	async function generate() {
		// Feed the operator's typed note into the draft context so AI drafting
		// considers it rather than ignoring/overwriting it.
		const context = partyContext() + (msg.trim() ? `. The officer also wants: ${msg.trim()}` : "");
		const text = await draft.mutateAsync({ items: selectedItems(), context });
		setMsg(text); // editable draft — operator reviews/edits before sending
	}

	async function generateMore() {
		const items = await regen.mutateAsync({
			party_id: party.party_id,
			note: msg.trim() || null,
			exclude: sugg.map((s) => s.title).filter(Boolean) as string[],
		});
		// Regenerate REPLACES the shown suggestions; drop the stale pill selection.
		setOverride(items);
		setSelected(new Set());
		setRegenerated(true); // unlocks the empty-state note when items come back []
	}

	const canSend = selectedItems().length > 0 || msg.trim().length > 0;
	// Items picked but no message yet → the primary action is "Draft with AI"
	// (generate the message from the selected items), then it flips to Send.
	const draftMode = selectedItems().length > 0 && !msg.trim();

	async function sendMessage() {
		if (!canSend) return;
		await send.mutateAsync({ party_id: party.party_id, items: selectedItems(), message: msg.trim() || null });
		setMsg("");
		setSelected(new Set());
		setCustom([]);
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
				{party.thread.length > 0 && (
					<button type="button" onClick={() => { if (window.confirm("Clear this conversation? The link and access code stay; you can resend.")) clearThread.mutate(party.party_id); }} disabled={clearThread.isPending} title="Clear conversation (resend)" aria-label="Clear conversation" className="shrink-0 h-9 w-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-50 flex items-center justify-center"><Eraser size={16} /></button>
				)}
				<button type="button" onClick={remove} disabled={del.isPending} title="Remove" aria-label="Remove" className="shrink-0 h-9 w-9 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-50"><X size={16} /></button>
			</header>

			{/* Conversation — the main area */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-slate-50">
				{loading && party.thread.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
						<Loader2 size={22} className="animate-spin" />
						<p className="text-sm">Loading conversation…</p>
					</div>
				) : party.thread.length === 0 && !borrowerTyping ? (
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
					party.thread.map((m, i) => {
						// Run grouping: a run is consecutive messages from the same
						// author. The avatar shows only on the LAST bubble of a run
						// (a spacer holds the column otherwise) so back-to-back
						// messages read as one speaker, alternating sides.
						const prev = party.thread[i - 1];
						const next = party.thread[i + 1];
						const endsRun = !next || next.author_kind !== m.author_kind;
						// WhatsApp-style date pill before the first message and at
						// each calendar-day boundary.
						const showDay = i === 0 || !isSameDay(prev.created_at, m.created_at);
						return (
							<div key={m.message_id}>
								{showDay && <DateSeparator iso={m.created_at} />}
								<OpBubble
									m={m}
									showAvatar={endsRun}
									officerName={officerName ?? ""}
									officerAvatar={officerAvatar ?? ""}
									borrowerName={party.display_name || roleLabel(party.role)}
									onAvatarClick={() => setWebcamOpen(true)}
									onDelete={() =>
										deleteMessage.mutate({ partyId: party.party_id, messageId: m.message_id })
									}
									onEdit={(body) =>
										editMessage.mutate({ partyId: party.party_id, messageId: m.message_id, body })
									}
								/>
							</div>
						);
					})
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
				<div ref={bottomRef} />
			</div>

			{/* Composer — suggestion pills sit directly above the message input */}
			<div className="border-t border-slate-200 px-4 py-3 space-y-2">
				<div className="flex flex-wrap items-center gap-1.5">
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
					{custom.map((c, i) => (
						<span key={`c-${i}`} className="inline-flex items-center gap-1 text-xs rounded-full px-3 py-1 border bg-indigo-600 border-indigo-600 text-white">
							✓ {c}
							<button type="button" onClick={() => setCustom((cs) => cs.filter((_, j) => j !== i))} className="hover:text-indigo-200" aria-label="Remove">×</button>
						</span>
					))}
					{addingOwn ? (
						<input
							autoFocus
							value={customInput}
							onChange={(e) => setCustomInput(e.target.value)}
							onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOwn(); } if (e.key === "Escape") setAddingOwn(false); }}
							onBlur={() => { addOwn(); setAddingOwn(false); }}
							placeholder="Type a request, Enter to add"
							className="text-xs rounded-full px-3 py-1 border border-indigo-400 outline-none w-48"
						/>
					) : (
						<button type="button" onClick={() => setAddingOwn(true)} className="text-xs rounded-full px-3 py-1 border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600">+ Add your own</button>
					)}
					<button
						type="button"
						onClick={generateMore}
						disabled={regen.isPending}
						title="Generate more (uses your note)"
						aria-label="Generate more suggestions"
						className="shrink-0 h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-50 flex items-center justify-center"
					>
						<RefreshCw size={14} className={regen.isPending ? "animate-spin" : ""} />
					</button>
				</div>
				{regenerated && !regen.isPending && sugg.length === 0 && (
					<p className="text-xs text-slate-400">
						No suggestions for this case yet — add your own above or type a message below.
					</p>
				)}
				{draftMode && (
					<p className="text-[11px] text-violet-600">{selectedItems().length} selected — hit <span className="font-medium">Draft with AI</span>, then edit & send.</p>
					)}
					<div className="flex items-end gap-2">
					<textarea
						ref={textareaRef}
						value={msg}
						onChange={(e) => { setMsg(e.target.value); sendTyping(); }}
						onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); draftMode ? generate() : sendMessage(); } }}
						rows={1}
						placeholder={selectedItems().length ? "Add a note, or draft with AI →" : "Message…"}
						className="flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm max-h-40 overflow-y-auto"
					/>
					{draftMode ? (
						<button type="button" onClick={generate} disabled={draft.isPending} className="shrink-0 h-10 rounded-full bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-sm font-medium px-4 inline-flex items-center gap-1.5">
							<Sparkles size={16} />
							{draft.isPending ? "Drafting…" : "Draft with AI"}
						</button>
					) : (
						<button type="button" onClick={sendMessage} disabled={send.isPending || !canSend} className="shrink-0 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4">
							{send.isPending ? "…" : "Send"}
						</button>
					)}
				</div>
			</div>

			{/* Webcam capture for the loan-officer avatar. Opened by clicking the
			    operator's own "You" avatar on a bubble; saving sets it firm-wide and
			    the overview refetch repaints the avatar live. */}
			<WebcamCaptureModal
				open={webcamOpen}
				currentPhoto={officerAvatar || null}
				onSave={(dataUrl) => setAvatar.mutate(dataUrl)}
				onClose={() => setWebcamOpen(false)}
			/>
		</div>
	);
}

/** Operator-perspective staggered chat row — avatar + bubble, "You" (operator)
 * right, borrower left. The avatar sits on the speaker's outer edge and is shown
 * only on the LAST bubble of a consecutive run (a spacer holds the column
 * otherwise). The operator's own ("You") avatar is clickable — it opens the
 * webcam capture so the loan officer can set their photo. Non-upload bubbles get
 * a hover delete; upload bubbles (synthesized from case events) are not deletable. */
function OpBubble({
	m,
	showAvatar,
	officerName,
	officerAvatar,
	borrowerName,
	onAvatarClick,
	onDelete,
	onEdit,
}: {
	m: ThreadItem;
	showAvatar: boolean;
	officerName: string;
	officerAvatar: string;
	borrowerName: string;
	onAvatarClick: () => void;
	onDelete: () => void;
	onEdit: (body: string) => void;
}) {
	const mine = m.author_kind === "operator";
	const items = (m.items ?? []) as Array<{ title?: string }>;
	const align = mine ? "items-end" : "items-start";
	const deleted = m.deleted === true;
	// Inline edit: the bubble body becomes a textarea prefilled with the body.
	const [editing, setEditing] = useState(false);
	const [draftBody, setDraftBody] = useState(m.body ?? "");
	// Own-only + never on uploads/deleted: the operator may modify only their OWN
	// (operator-authored) message rows. Uploads are synthesized from events (no
	// row); deleted messages are tombstones.
	const canModify = mine && m.kind !== "upload" && !deleted;

	function saveEdit() {
		const next = draftBody.trim();
		if (next && next !== (m.body ?? "")) onEdit(next);
		setEditing(false);
	}
	function cancelEdit() {
		setDraftBody(m.body ?? "");
		setEditing(false);
	}

	// Avatar column (28px): the face on the last bubble of a run, a spacer
	// otherwise. The operator's own avatar is clickable → opens webcam capture.
	const avatar = showAvatar ? (
		mine ? (
			<Avatar
				size={40}
				name={officerName || "You"}
				photoUrl={officerAvatar || null}
				onClick={onAvatarClick}
				title="Set your photo"
			/>
		) : (
			<Avatar size={40} name={borrowerName} title={borrowerName} />
		)
	) : (
		<span className="shrink-0" style={{ width: 40 }} />
	);

	const inner = deleted ? (
		<div className={`inline-flex items-center gap-1.5 max-w-[80%] rounded-2xl px-3 py-2 text-sm italic text-slate-400 ${mine ? "bg-slate-100" : "bg-white border border-slate-200"}`}>
			<Ban size={13} className="shrink-0" /> This message was deleted
		</div>
	) : editing ? (
		<div className="w-64 max-w-full rounded-2xl border border-indigo-300 bg-white p-2 shadow-sm">
			<textarea
				value={draftBody}
				onChange={(e) => setDraftBody(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Escape") cancelEdit();
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit();
				}}
				rows={2}
				autoFocus
				className="w-full resize-none rounded-lg bg-slate-50 px-2 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-400"
			/>
			<div className="mt-1 flex justify-end gap-3 text-xs">
				<button type="button" onClick={cancelEdit} className="text-slate-500 hover:text-slate-700">Cancel</button>
				<button type="button" onClick={saveEdit} className="font-semibold text-indigo-600 hover:text-indigo-800">Save</button>
			</div>
		</div>
	) : m.kind === "upload" ? (
		<div className={`flex items-center gap-2 max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-700"}`}>
			<FileText size={14} />{m.body}
		</div>
	) : (
		<div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-800"}`}>
			<p className="text-[10px] opacity-70 mb-0.5">{mine ? "You" : "Borrower"}</p>
			{m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
			{items.length > 0 && (
				<ul className={`mt-1 ml-4 list-disc ${mine ? "text-indigo-100" : "text-slate-600"}`}>
					{items.map((it, i) => <li key={i}>{it.title}</li>)}
				</ul>
			)}
		</div>
	);

	return (
		<div className={`group flex flex-col w-full ${align}`}>
			<div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
				{avatar}
				<div className={`flex items-center gap-1.5 ${mine ? "flex-row" : "flex-row-reverse"}`}>
					{/* Edit + delete show ONLY on the operator's own non-deleted, non-upload
					    bubbles, and are hidden while editing. */}
					{canModify && !editing && (
						<div className={`flex items-center gap-0.5 ${mine ? "flex-row" : "flex-row-reverse"}`}>
							<button
								type="button"
								onClick={() => { setDraftBody(m.body ?? ""); setEditing(true); }}
								aria-label="Edit message"
								className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-indigo-500 p-1"
							>
								<Pencil size={13} />
							</button>
							<button
								type="button"
								onClick={onDelete}
								aria-label="Delete message"
								className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500 p-1"
							>
								<Trash2 size={13} />
							</button>
						</div>
					)}
					{inner}
				</div>
			</div>
			{showAvatar && (
				<span className={`flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 ${mine ? "pr-10 flex-row-reverse" : "pl-10"}`}>
					{clockTime(m.created_at)}
					{m.edited && !deleted && <span>· edited</span>}
					{/* On the operator's OWN bubbles, the ✓/✓✓ receipt reflects whether
					    the borrower has read it (✓✓ = read). Not shown on tombstones. */}
					{mine && !deleted && (m.read ? <CheckCheck size={12} className="text-indigo-400" /> : <Check size={12} className="text-slate-400" />)}
				</span>
			)}
		</div>
	);
}
