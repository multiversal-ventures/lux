import { useState } from "react";
import { useCreatePortalLink, buildPortalUrl } from "../../hooks/useCreatePortalLink.js";

export interface BorrowerPortalLinkProps {
	caseId: string;
	/** Host-supplied base the borrower portal lives at (e.g. https://app.example.com/portal). */
	portalBaseUrl: string;
	/** Called when the operator dismisses the modal. */
	onClose?: () => void;
	className?: string;
}

/**
 * Operator modal that issues a one-time, expiring borrower portal link for a
 * case and surfaces the shareable URL. Wraps {@link useCreatePortalLink}; the
 * token comes from veritas, the URL is built host-side (veritas is URL-agnostic).
 *
 * States: idle → generating → link (copyable) / error. A 409 means no borrower
 * is resolved yet — shown verbatim so the operator knows to run resolution.
 */
export function BorrowerPortalLink({
	caseId,
	portalBaseUrl,
	onClose,
	className,
}: BorrowerPortalLinkProps) {
	const mutation = useCreatePortalLink(caseId);
	const [copied, setCopied] = useState(false);

	const link = mutation.data ? buildPortalUrl(portalBaseUrl, mutation.data.token) : null;

	async function copy() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	}

	return (
		<div className={`bg-white rounded-2xl shadow-xl p-6 max-w-md w-full${className ? ` ${className}` : ""}`}>
			<div className="flex items-start justify-between mb-2">
				<h3 className="flex items-center gap-2 font-semibold text-slate-900">
					<span aria-hidden className="text-indigo-600">🔗</span>
					Borrower Portal Link
				</h3>
				{onClose && (
					<button type="button" onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
						×
					</button>
				)}
			</div>

			<p className="text-sm text-slate-600 mb-4">
				Create a one-time, expiring URL that lets the borrower securely upload documents and
				review their application — no login required. The link is valid for 48 hours.
			</p>

			{!link && (
				<>
					{mutation.error && (
						<p className="text-sm text-red-600 mb-3" role="alert">
							{mutation.error.message}
						</p>
					)}
					<button
						type="button"
						onClick={() => mutation.mutate()}
						disabled={mutation.isPending}
						className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium py-3 flex items-center justify-center gap-2"
					>
						{mutation.isPending ? "Generating…" : "Generate Portal Link"}
					</button>
				</>
			)}

			{link && (
				<div className="space-y-3">
					<label className="block text-xs font-medium text-slate-500">Shareable link</label>
					<div className="flex items-center gap-2">
						<input
							readOnly
							value={link}
							onFocus={(e) => e.currentTarget.select()}
							className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
						/>
						<button
							type="button"
							onClick={copy}
							className="rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-sm font-medium px-4 py-2 whitespace-nowrap"
						>
							{copied ? "Copied" : "Copy"}
						</button>
					</div>
					{mutation.data && (
						<p className="text-xs text-slate-400">
							Expires {new Date(mutation.data.expires_at).toLocaleString()}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
