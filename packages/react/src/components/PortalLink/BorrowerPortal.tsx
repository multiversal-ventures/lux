import { useRef, useState } from "react";
import { usePortalSession } from "../../hooks/usePortalSession.js";
import { Checklist } from "../Checklist/index.js";
import type { components } from "@multiversal-ventures/lux-core";

type KbaQuestion = components["schemas"]["KbaQuestion"];

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

	// Once submitted, the link is done — show a thank-you (a reload 401s).
	if (session.submitted) {
		return (
			<div className={wrap(className)}>
				<div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
					<div className="text-3xl mb-2" aria-hidden>✓</div>
					<h2 className="font-semibold text-green-900 mb-1">Thank you{session.entity?.name ? `, ${session.entity.name}` : ""}!</h2>
					<p className="text-sm text-green-700">
						Your documents were submitted. Your loan officer will follow up — you can close this page.
					</p>
				</div>
			</div>
		);
	}

	const kycRequired = session.kba_questions.length > 0;
	const verified = !kycRequired || session.verification.verified;
	const signed = session.signed;
	const step = !verified ? 1 : !signed ? 2 : 3;

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

	return (
		<div className={wrap(className)}>
			<header className="mb-6">
				<h1 className="text-xl font-semibold text-slate-900">
					Welcome{session.entity?.name ? `, ${session.entity.name}` : ""}
				</h1>
				<p className="text-sm text-slate-500">
					{session.requested_by
						? `${session.requested_by} has requested some documents to move your application forward.`
						: "Upload your documents to move your application forward."}
				</p>
				{session.request_message && (
					<div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-slate-700">
						{session.request_message}
					</div>
				)}
			</header>

			<Stepper current={step} />

			{step === 1 && (
				<KbaStep
					questions={session.kba_questions}
					name={name}
					verified={session.verification.verified}
					onVerify={(claims) => submitIntent([{ type: "verify", params: { claims } }])}
				/>
			)}

			{step === 2 && (
				<SignStep name={name} onSign={(signature) => submitIntent([{ type: "sign", params: { signature } }])} />
			)}

			{step === 3 && (
				<section>
					<StepHeading n={3} title="Upload & submit" />
					<div className="mb-6">
						<Checklist items={session.checklist} />
					</div>
					<div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
						<input
							ref={fileRef}
							type="file"
							multiple
							accept=".pdf,.png,.jpg,.jpeg"
							disabled={uploading}
							onChange={(e) => onFiles(e.target.files)}
							className="block text-sm text-slate-600"
						/>
						{uploading && <p className="text-xs text-slate-500">Uploading…</p>}
						{session.uploaded_files.length > 0 && (
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">
									Uploaded ({session.uploaded_files.length})
								</p>
								<ul className="space-y-1">
									{session.uploaded_files.map((f, i) => (
										<li key={i} className="flex items-center gap-2 text-sm text-slate-700">
											<span className="text-green-600" aria-hidden>✓</span>{f}
										</li>
									))}
								</ul>
							</div>
						)}
						<button
							type="button"
							onClick={submit}
							disabled={finishing || session.uploaded_files.length === 0}
							className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
						>
							{finishing ? "Submitting…" : "Submit documents"}
						</button>
						{session.uploaded_files.length === 0 && (
							<p className="text-xs text-amber-600 text-center">Upload at least one document to submit.</p>
						)}
					</div>
				</section>
			)}
		</div>
	);
}

/** KBA identity step — answer questions derived from the borrower's documents. */
function KbaStep({
	questions,
	name,
	verified,
	onVerify,
}: {
	questions: KbaQuestion[];
	name: string;
	verified: boolean;
	onVerify: (claims: Record<string, string>) => Promise<void>;
}) {
	const [answers, setAnswers] = useState<Record<string, string>>({});
	const [submitting, setSubmitting] = useState(false);
	const [failed, setFailed] = useState(false);

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
				<p className="text-sm text-slate-500">
					To protect {name}, answer these from your records before continuing.
				</p>
				{questions.map((q) => (
					<div key={q.id}>
						<label className="block text-sm font-medium text-slate-700 mb-1">{q.prompt}</label>
						<input
							type="text"
							value={answers[q.id] ?? ""}
							onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
							className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
						/>
					</div>
				))}
				{failed && (
					<p className="text-sm text-red-600" role="alert">
						Those answers didn't match our records. Please try again.
					</p>
				)}
				<button
					type="button"
					onClick={submit}
					disabled={submitting || Object.keys(answers).length === 0}
					className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3"
				>
					{submitting ? "Verifying…" : "Verify my identity"}
				</button>
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
