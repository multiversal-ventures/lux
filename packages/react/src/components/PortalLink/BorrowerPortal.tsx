import { useRef, useState, type InputHTMLAttributes } from "react";
import { FileText, Lock, Paperclip } from "lucide-react";
import { usePortalSession } from "../../hooks/usePortalSession.js";
import { Checklist } from "../Checklist/index.js";
import type { components } from "@multiversal-ventures/lux-core";

type KbaQuestion = components["schemas"]["KbaQuestion"];
type ThreadMessage = components["schemas"]["ThreadMessage"];

export interface BorrowerPortalProps {
	/** Portal token from the URL (`?token=…`), or null for an immediate error. */
	token: string | null;
	className?: string;
}

/**
 * Borrower-facing portal, composed from lux pieces. A sequential flow —
 * **Identity (KBA) → E-sign + consent → Upload & submit** — each gate unlocking
 * the next. On submit the link is consumed (expires); the next visit shows
 * "link unavailable". No login; the token is the auth.
 */
export function BorrowerPortal({ token, className }: BorrowerPortalProps) {
	const { session, loading, error, submitIntent, uploadDocuments } = usePortalSession(token);
	const fileRef = useRef<HTMLInputElement>(null);
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

	const kycRequired = session.kba_questions.length > 0;
	const verified = !kycRequired || session.verification.verified;
	const signed = session.signed;
	const step = !verified ? 1 : !signed ? 2 : 3;
	const openRequests = session.thread.filter((m) => m.kind === "request" && m.status === "open");

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

	// Steps 1–2 are gates (centered cards). Step 3 is a full-height chat.
	if (step !== 3) {
		return (
			<div className={wrap(className)}>
				<Stepper current={step} />
				{step === 1 ? (
					<KbaStep
						questions={session.kba_questions}
						verified={session.verification.verified}
						onVerify={(claims) => submitIntent([{ type: "verify", params: { claims } }])}
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

			<div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-slate-50">
				{session.request_message && (
					<div className="mx-auto max-w-[90%] text-center text-xs text-slate-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
						{session.request_message}
					</div>
				)}
				{session.thread.map((m) => <Bubble key={m.message_id} m={m} />)}
				{session.thread.length === 0 && (
					<p className="text-center text-sm text-slate-400 mt-8">No messages yet.</p>
				)}
				{uploading && <div className="flex justify-end"><span className="text-xs text-slate-400">Uploading…</span></div>}
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
						onChange={(e) => setReplyText(e.target.value)}
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

/** A single chat bubble — officer left, borrower right; uploads as file chips. */
function Bubble({ m }: { m: ThreadMessage }) {
	const mine = m.author_kind === "borrower";
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

/** Input affordances per known KBA fact — numeric SSN, date-of-birth hint. */
function kbaFieldProps(id: string): InputHTMLAttributes<HTMLInputElement> {
	if (id.includes("ssn")) return { inputMode: "numeric", maxLength: 4, placeholder: "••••", autoComplete: "off" };
	if (id.includes("dob")) return { inputMode: "numeric", placeholder: "MM/DD/YYYY", autoComplete: "off" };
	return { autoComplete: "off" };
}

function KbaStep({
	questions,
	verified,
	onVerify,
}: {
	questions: KbaQuestion[];
	verified: boolean;
	onVerify: (claims: Record<string, string>) => Promise<void>;
}) {
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);

	const allFilled = questions.every((q) => (answers[q.id] ?? "").trim().length > 0);

	async function submit() {
		setSubmitting(true);
		setFailed(false);
		await onVerify(answers);
		setSubmitting(false);
		if (!verified) setFailed(true);
	}

	return (
		<section>
			<StepHeading n={1} title="Confirm your identity" />
			<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
				<p className="text-sm text-slate-600">
					Please confirm your identity to continue. We'll ask for a couple of details only you would
					know — this keeps your application secure.
				</p>
				{questions.map((q) => (
					<div key={q.id}>
						<label htmlFor={`kba-${q.id}`} className="block text-sm font-medium text-slate-700 mb-1">{q.prompt}</label>
						<input
							id={`kba-${q.id}`}
							type="text"
							value={answers[q.id] ?? ""}
							onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
							onKeyDown={(e) => { if (e.key === "Enter" && allFilled) submit(); }}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-wide"
							{...kbaFieldProps(q.id)}
						/>
					</div>
				))}
				{failed && (
					<p className="text-sm text-red-600" role="alert">
						That didn't match our records. Double-check and try again.
					</p>
				)}
				<button
					type="button"
					onClick={submit}
					disabled={submitting || !allFilled}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Checking…" : "Continue"}
				</button>
				<p className="text-xs text-slate-400 flex items-center gap-1">
					<Lock size={12} /> Your answers are encrypted and never shared.
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

const STEPS = ["Identity", "Sign", "Submit"];

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
