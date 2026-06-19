import { useRef, useState } from "react";
import { usePortalSession } from "../../hooks/usePortalSession.js";
import { ConsentBanner } from "../ConsentBanner/index.js";
import { Checklist } from "../Checklist/index.js";

export interface BorrowerPortalProps {
	/** Portal token from the URL (`?token=…`), or null for an immediate error. */
	token: string | null;
	className?: string;
}

/**
 * Borrower-facing portal page, composed entirely from lux pieces:
 * `usePortalSession` (token → session, consent, checklist, upload) +
 * `ConsentBanner` + `Checklist` + an upload control. No login — the token is the
 * auth. Hosts (gunnr) render this at their `/portal` route and pass the token.
 */
export function BorrowerPortal({ token, className }: BorrowerPortalProps) {
	const { session, loading, error, submitIntent, uploadDocuments } = usePortalSession(token);
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);

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

	const accept = ".pdf,.png,.jpg,.jpeg";

	async function onFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setUploading(true);
		await uploadDocuments(Array.from(files));
		setUploading(false);
		if (fileRef.current) fileRef.current.value = "";
	}

	return (
		<div className={wrap(className)}>
			<header className="mb-6">
				<h1 className="text-xl font-semibold text-slate-900">
					Welcome{session.entity?.name ? `, ${session.entity.name}` : ""}
				</h1>
				<p className="text-sm text-slate-500">
					Upload your documents to move your application forward.
				</p>
			</header>

			<ConsentBanner consent={session.consent} onSubmitIntent={submitIntent} className="mb-6" />

			<section className="mb-6">
				<h2 className="font-semibold text-slate-800 mb-3">Documents needed</h2>
				<Checklist items={session.checklist} />
			</section>

			<section className="bg-white border border-slate-200 rounded-xl p-6">
				<h2 className="font-semibold text-slate-800 mb-2">Upload documents</h2>
				<input
					ref={fileRef}
					type="file"
					multiple
					accept={accept}
					disabled={uploading || !session.consent.doc_sharing}
					onChange={(e) => onFiles(e.target.files)}
					className="block text-sm text-slate-600"
				/>
				{!session.consent.doc_sharing && (
					<p className="text-xs text-amber-600 mt-2">Grant consent above before uploading.</p>
				)}
				{uploading && <p className="text-xs text-slate-500 mt-2">Uploading…</p>}
			</section>
		</div>
	);
}

function wrap(className?: string): string {
	return `max-w-2xl mx-auto p-6${className ? ` ${className}` : ""}`;
}
