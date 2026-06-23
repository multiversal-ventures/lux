import { useEffect, useRef, useState } from "react";
import { Ban, Check, CheckCheck, FileText, Loader2, Lock, Mail, Paperclip, Pencil, Trash2 } from "lucide-react";
import { usePortalSession } from "../../hooks/usePortalSession.js";
import { clockTime, isSameDay } from "../../timeAgo.js";
import { Avatar } from "../Avatar.js";
import { DateSeparator } from "../DateSeparator.js";
import { Checklist } from "../Checklist/index.js";
import type { components } from "@multiversal-ventures/lux-core";

type ThreadMessage = components["schemas"]["ThreadMessage"];

export interface BorrowerPortalProps {
	/** Portal token from the URL (`?token=…`), or null for an immediate error. */
	token: string | null;
	className?: string;
	/** Host hook to create a returnable account for the email (e.g. send a
	 * Firebase magic link). Called alongside storing the email server-side. */
	onCreateAccount?: (email: string) => Promise<void>;
}

/**
 * Borrower-facing portal, composed from lux pieces. A sequential flow —
 * **Identity (KBA) → E-sign + consent → Upload & submit** — each gate unlocking
 * the next. On submit the link is consumed (expires); the next visit shows
 * "link unavailable". No login; the token is the auth.
 */
export function BorrowerPortal({ token, className, onCreateAccount }: BorrowerPortalProps) {
	const { session, loading, error, submitIntent, uploadDocuments, operatorTyping, sendTyping } = usePortalSession(token);
	const fileRef = useRef<HTMLInputElement>(null);
	const lastTyped = useRef(0);
	// WhatsApp-style auto-scroll: scroll container + bottom sentinel. Stick to the
	// bottom only when the borrower is already near it, so new officer messages
	// don't yank them up while they read history. First paint jumps instantly.
	const scrollRef = useRef<HTMLDivElement>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const didInitialScroll = useRef(false);
	const threadLen = session?.thread.length ?? 0;
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

	function onTyping() {
		const now = Date.now();
		if (now - lastTyped.current > 1500) {
			lastTyped.current = now;
			sendTyping();
		}
	}
	const [skippedAccount, setSkippedAccount] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [finishing, setFinishing] = useState(false);
	const [replyText, setReplyText] = useState("");
	const [sendingReply, setSendingReply] = useState(false);

	if (loading) {
		return <div className={wrap(className)}><p className="text-slate-500">Loading…</p></div>;
	}

	if (error || !session) {
		const msg = error?.message ?? "This link is invalid or has expired.";
		return (
			<div className={wrap(className)}>
				<div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
					<h2 className="font-semibold text-red-900 mb-1">Link unavailable</h2>
					<p className="text-sm text-red-700">{msg}</p>
					<p className="text-xs text-red-500 mt-2">Ask your loan officer to send a new link.</p>
				</div>
			</div>
		);
	}

	const name = session.entity?.name || "the borrower";

	const verified = session.verification.verified;
	// Advance past the account step only when the account is actually CLAIMED
	// (a Firebase uid is bound via claim-account, after the borrower clicks the
	// magic link and returns signed-in) — NOT when the email is merely submitted.
	const accountDone = !!session.has_account;
	const signed = session.signed;
	const step = !verified ? 1 : (!accountDone && !skippedAccount) ? 2 : !signed ? 3 : 4;
	const openRequests = session.thread.filter((m) => m.kind === "request" && m.status === "open");
	// Show the friendly "officer will reply" line when the borrower spoke last
	// (the most recent message is theirs) and the officer isn't mid-reply.
	const lastMsg = session.thread[session.thread.length - 1];
	const waitingForReply = !!lastMsg && lastMsg.author_kind === "borrower" && !operatorTyping;

	async function createAccount(email: string) {
		await submitIntent([{ type: "set_email", params: { email } }]);
		if (onCreateAccount) await onCreateAccount(email);
	}

	async function onFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setUploading(true);
		await uploadDocuments(Array.from(files));
		setUploading(false);
		if (fileRef.current) fileRef.current.value = "";
	}

	async function submit() {
		setFinishing(true);
		await submitIntent([{ type: "submit", params: {} }]);
		setFinishing(false);
	}

	async function sendReply() {
		const t = replyText.trim();
		if (!t) return;
		setSendingReply(true);
		await submitIntent([{ type: "reply", params: { text: t } }]);
		setSendingReply(false);
		setReplyText("");
	}

	// Steps 1–3 are gates (centered cards). Step 4 is the full-height chat.
	if (step !== 4) {
		return (
			<div className={wrap(className)}>
				<Stepper current={step} />
				{step === 1 ? (
					<CodeStep
						verified={session.verification.verified}
						onVerify={(code) => submitIntent([{ type: "verify", params: { code } }])}
					/>
				) : step === 2 ? (
					<AccountStep
						onSubmit={createAccount}
						onSkip={() => setSkippedAccount(true)}
						returning={!!session.account_email}
						initialEmail={session.account_email ?? ""}
					/>
				) : (
					<SignStep name={name} onSign={(signature) => submitIntent([{ type: "sign", params: { signature } }])} />
				)}
			</div>
		);
	}

	return (
		<div className={`flex flex-col h-full mx-auto w-full max-w-2xl bg-white ${className ?? ""}`}>
			<header className="px-4 py-3 border-b border-slate-200">
				<h1 className="font-semibold text-slate-900">
					{session.requested_by || "Your documents"}
				</h1>
				<p className="text-xs text-slate-500">
					{openRequests.length > 0 ? `${openRequests.length} request${openRequests.length > 1 ? "s" : ""} pending` : "All caught up"}
				</p>
			</header>

			<div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-1 bg-slate-50">
				{loading && session.thread.length === 0 ? (
					<div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
						<Loader2 size={22} className="animate-spin" />
						<p className="text-sm">Loading conversation…</p>
					</div>
				) : (
					<>
						{session.request_message && (
							<div className="mx-auto max-w-[90%] text-center text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
								{session.request_message}
							</div>
						)}
						{session.thread.map((m, i) => {
							// Run grouping: a "run" is consecutive messages from the same
							// author. The "Your loan officer" label shows on the FIRST officer
							// bubble of a run; the avatar shows on the LAST bubble of a run
							// (a spacer keeps alignment on the others) — so a back-to-back
							// reply reads as one person speaking, not a wall of avatars.
							const prev = session.thread[i - 1];
							const next = session.thread[i + 1];
							const startsRun = !prev || prev.author_kind !== m.author_kind;
							const endsRun = !next || next.author_kind !== m.author_kind;
							const isOfficer = m.author_kind !== "borrower";
							// WhatsApp-style date pill before the first message and at
							// each calendar-day boundary.
							const showDay = i === 0 || !isSameDay(prev.created_at, m.created_at);
							return (
								<div key={m.message_id}>
									{showDay && <DateSeparator iso={m.created_at} />}
									<Bubble
										m={m}
										showOfficerHeader={isOfficer && startsRun}
										showAvatar={endsRun}
										officerName={session.officer_name}
										officerAvatar={session.officer_avatar}
										borrowerName={session.entity?.name || "You"}
										onDelete={() =>
											submitIntent([{ type: "delete_message", params: { message_id: m.message_id } }])
										}
										onEdit={(body) =>
											submitIntent([{ type: "edit_message", params: { message_id: m.message_id, text: body } }])
										}
									/>
								</div>
							);
						})}
						{session.thread.length === 0 && !operatorTyping && (
							<p className="text-center text-sm text-slate-400 mt-8">No messages yet.</p>
						)}
						{operatorTyping && <TypingBubble />}
						{waitingForReply && (
							<p className="text-center text-xs text-slate-400 mt-3">
								Your loan officer will reply here — we'll let you know.
							</p>
						)}
						{uploading && <div className="flex justify-end"><span className="text-xs text-slate-400">Uploading…</span></div>}
					</>
				)}
				<div ref={bottomRef} />
			</div>

			<div className="border-t border-slate-200 bg-white px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
				{openRequests.length > 0 && session.uploaded_files.length > 0 && (
					<button
						type="button"
						onClick={submit}
						disabled={finishing}
						className="w-full mb-2 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-medium py-2"
					>
						{finishing ? "Submitting…" : "I've sent everything — submit"}
					</button>
				)}
				<div className="flex items-end gap-2">
					<input ref={fileRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={(e) => onFiles(e.target.files)} />
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						disabled={uploading}
						aria-label="Attach documents"
						className="shrink-0 h-10 w-10 rounded-full bg-slate-100 hover:bg-slate-200 text-lg disabled:opacity-50"
					>
						<Paperclip size={18} />
					</button>
					<textarea
						value={replyText}
						onChange={(e) => { setReplyText(e.target.value); onTyping(); }}
						onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
						rows={1}
						placeholder="Message…"
						className="flex-1 resize-none rounded-2xl border border-slate-300 px-3 py-2 text-sm max-h-32"
					/>
					<button
						type="button"
						onClick={sendReply}
						disabled={sendingReply || !replyText.trim()}
						className="shrink-0 h-10 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4"
					>
						Send
					</button>
				</div>
			</div>
		</div>
	);
}

/** The "Your loan officer" label shown once at the start of each officer run —
 * indented to sit above the bubble (which is left-aligned, avatar on the left).
 * The face itself is the {@link Avatar} on the last bubble of the run. */
function OfficerHeader() {
	return (
		<div className="flex items-center gap-2 mb-0.5 pl-9">
			<span className="text-xs font-medium text-slate-500">Your loan officer</span>
		</div>
	);
}

/** A single staggered chat row — avatar + bubble. The sender sits on their own
 * side (borrower right, officer left); the avatar is adjacent to the bubble on
 * the outer edge, shown only on the LAST bubble of a consecutive run (a spacer
 * holds the column otherwise so bubbles stay aligned). Officer runs get the
 * "Your loan officer" header on their first bubble; the borrower's own bubbles
 * get a ✓/✓✓ read receipt and a hover delete (their request/reply messages
 * only — never uploads). */
function Bubble({
	m,
	showOfficerHeader,
	showAvatar,
	officerName,
	officerAvatar,
	borrowerName,
	onDelete,
	onEdit,
}: {
	m: ThreadMessage;
	showOfficerHeader: boolean;
	showAvatar: boolean;
	officerName: string;
	officerAvatar: string;
	borrowerName: string;
	onDelete: () => void;
	onEdit: (body: string) => void;
}) {
	const mine = m.author_kind === "borrower";
	const items = (m.items ?? []) as Array<{ title?: string }>;
	const align = mine ? "items-end" : "items-start";
	const deleted = m.deleted === true;
	// Inline edit: the bubble body becomes a textarea prefilled with the body.
	const [editing, setEditing] = useState(false);
	const [draftBody, setDraftBody] = useState(m.body ?? "");
	// The borrower can modify only their OWN non-upload, non-deleted messages
	// (uploads are case events with no row; deleted messages are tombstones).
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

	// Avatar column (40px, matching the operator side): the face on the last
	// bubble of a run, a spacer otherwise so consecutive bubbles in the run stay
	// aligned.
	const avatar = showAvatar ? (
		<Avatar
			size={40}
			name={mine ? borrowerName : officerName || "Loan officer"}
			photoUrl={mine ? null : officerAvatar}
			title={mine ? borrowerName : officerName || "Your loan officer"}
		/>
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
			{!mine && showOfficerHeader && <OfficerHeader />}
			{/* Row reads inward from the speaker's side: [avatar][edit][delete][bubble]
			    for the officer (left), mirrored for the borrower (right). */}
			<div className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
				{avatar}
				<div className={`flex items-center gap-1.5 ${mine ? "flex-row" : "flex-row-reverse"}`}>
					{/* Edit + delete show ONLY on the borrower's own non-deleted, non-upload
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
					{/* On the borrower's OWN bubbles, the ✓/✓✓ receipt reflects whether
					    the loan officer has read it (✓✓ = read). Not shown on tombstones. */}
					{mine && !deleted && (m.read ? <CheckCheck size={12} className="text-indigo-400" /> : <Check size={12} className="text-slate-400" />)}
				</span>
			)}
		</div>
	);
}

/** Animated "officer is typing" bubble. */
function TypingBubble() {
	return (
		<div className="flex justify-start">
			<div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex gap-1">
				<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0ms]" />
				<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:150ms]" />
				<span className="h-1.5 w-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:300ms]" />
			</div>
		</div>
	);
}

function CodeStep({
	verified,
	onVerify,
}: {
	verified: boolean;
	onVerify: (code: string) => Promise<void>;
}) {
	const [code, setCode] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);

	async function submit() {
		setSubmitting(true);
		setFailed(false);
		await onVerify(code.trim());
		setSubmitting(false);
		if (!verified) setFailed(true);
	}

	return (
		<section>
			<StepHeading n={1} title="Enter your access code" />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					Your loan officer sent you a code along with this link. Enter it below to securely
					access your application.
				</p>
				<input
					type="text"
					inputMode="numeric"
					maxLength={5}
					value={code}
					onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
					onKeyDown={(e) => { if (e.key === "Enter" && code.length >= 4) submit(); }}
					placeholder="• • • • •"
					autoComplete="one-time-code"
					className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.5em] font-mono"
				/>
				{failed && (
					<p className="text-sm text-red-600" role="alert">
						That code didn't match. Check the code your loan officer sent you.
					</p>
				)}
				<button
					type="button"
					onClick={submit}
					disabled={submitting || code.length < 4}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Checking…" : "Continue"}
				</button>
				<p className="text-xs text-slate-400 flex items-center gap-1">
					<Lock size={12} /> Don't have a code? Ask your loan officer.
				</p>
			</div>
		</section>
	);
}

/** E-signature + consent step — type full name to consent and e-sign. */
function SignStep({ name, onSign }: { name: string; onSign: (signature: string) => Promise<void> }) {
	const [signature, setSignature] = useState("");
	const [agreed, setAgreed] = useState(false);
	const [submitting, setSubmitting] = useState(false);

	async function submit() {
		setSubmitting(true);
		await onSign(signature.trim());
		setSubmitting(false);
	}

	return (
		<section>
			<StepHeading n={2} title="Consent & e-signature" />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					To share documents electronically, please consent and sign below. You can revoke this
					by contacting your loan officer.
				</p>
				<label className="flex gap-3 text-sm text-slate-700">
					<input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1" />
					<span>
						I agree to electronically process and share the documents I provide, and I consent to
						electronic records and signatures.
					</span>
				</label>
				<div>
					<label className="block text-sm font-medium text-slate-700 mb-1">Type your full legal name to sign</label>
					<input
						type="text"
						value={signature}
						onChange={(e) => setSignature(e.target.value)}
						placeholder={name}
						className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-serif italic"
					/>
				</div>
				<button
					type="button"
					onClick={submit}
					disabled={submitting || !agreed || signature.trim().length === 0}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Signing…" : "Agree & e-sign"}
				</button>
			</div>
		</section>
	);
}

/** Account step — capture an email so the borrower can return (magic link).
 *
 * Submitting the email only SENDS the sign-in link; it does not claim the
 * account. So on submit we switch to a local waiting state ("Check your email")
 * and do NOT advance — advancing is driven solely by `session.has_account`
 * flipping true once the borrower clicks the link and returns signed-in (which
 * runs claim-account), or by Skip. The portal silently refetches the session,
 * so the step moves on on its own once the account is claimed. */
function AccountStep({
	onSubmit,
	onSkip,
	returning = false,
	initialEmail = "",
}: {
	onSubmit: (email: string) => Promise<void>;
	onSkip: () => void;
	/** They've been here before (an email is already on file) — sign-in framing. */
	returning?: boolean;
	initialEmail?: string;
}) {
	const [email, setEmail] = useState(initialEmail);
	const [submitting, setSubmitting] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const valid = email.includes("@") && email.includes(".");
	const title = returning ? "Use your email to continue" : "Create your account";

	async function submit() {
		if (!valid) return;
		setError(null);
		setSubmitting(true);
		try {
			await onSubmit(email.trim());
			setSent(true);
		} catch (e) {
			// Surface the real reason (Firebase rate-limit / quota / domain) instead
			// of leaving the button stuck on "Sending…".
			setError(e instanceof Error ? e.message : "Couldn't send the email. Please try again.");
		} finally {
			setSubmitting(false);
		}
	}

	if (sent) {
		return (
			<section>
				<StepHeading n={2} title={title} />
				<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 text-center">
					<div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 flex items-center justify-center">
						<Mail size={22} className="text-indigo-600" />
					</div>
					<div>
						<h3 className="font-semibold text-slate-800">Email sent — check your inbox</h3>
						<p className="text-sm text-slate-600 mt-1">
							We sent a secure sign-in link to <span className="font-medium text-slate-800">{email.trim()}</span>.
							Open it to continue — this page moves on automatically once you're signed in.
						</p>
					</div>
					<p className="text-xs text-amber-600">
						Don't see it? Check your spam or junk folder — it can take a minute to arrive.
					</p>
					<button
						type="button"
						onClick={submit}
						disabled={submitting}
						className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
					>
						{submitting ? "Resending…" : "Resend email"}
					</button>
					<button
						type="button"
						onClick={() => { setSent(false); setError(null); }}
						className="block w-full text-center text-xs text-slate-500 hover:text-slate-700"
					>
						Use a different email
					</button>
					<button
						type="button"
						onClick={onSkip}
						className="block w-full text-center text-xs text-slate-400 hover:text-slate-600"
					>
						Skip for now — you can create an account later
					</button>
				</div>
			</section>
		);
	}

	return (
		<section>
			<StepHeading n={2} title={title} />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					{returning
						? "Use your email to continue your application — we'll send you a secure sign-in link."
						: "Add your email so you can come back to your application anytime — we'll send you a secure sign-in link."}
				</p>
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					onKeyDown={(e) => { if (e.key === "Enter" && valid) submit(); }}
					placeholder="you@example.com"
					autoComplete="email"
					className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
				/>
				{error && <p className="text-sm text-red-600" role="alert">{error}</p>}
				<button
					type="button"
					onClick={submit}
					disabled={submitting || !valid}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Sending…" : "Continue"}
				</button>
				<button
					type="button"
					onClick={onSkip}
					className="w-full text-center text-xs text-slate-400 hover:text-slate-600"
				>
					Skip for now — you can create an account later
				</button>
			</div>
		</section>
	);
}

const STEPS = ["Verify", "Account", "Consent"];

function Stepper({ current }: { current: number }) {
	return (
		<ol className="flex items-center gap-2 mb-6">
			{STEPS.map((label, i) => {
				const n = i + 1;
				const state = n < current ? "done" : n === current ? "active" : "todo";
				return (
					<li key={label} className="flex items-center gap-2 flex-1">
						<span
							className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
								state === "done"
									? "bg-green-600 text-white"
									: state === "active"
										? "bg-indigo-600 text-white"
										: "bg-slate-200 text-slate-500"
							}`}
						>
							{state === "done" ? "✓" : n}
						</span>
						<span className={`text-xs ${state === "active" ? "text-slate-900 font-medium" : "text-slate-400"}`}>
							{label}
						</span>
						{n < STEPS.length && <span className="flex-1 h-px bg-slate-200" />}
					</li>
				);
			})}
		</ol>
	);
}

function StepHeading({ n, title }: { n: number; title: string }) {
	return <h2 className="font-semibold text-slate-800 mb-3">Step {n}: {title}</h2>;
}

function wrap(className?: string): string {
	return `max-w-2xl mx-auto p-6${className ? ` ${className}` : ""}`;
}
