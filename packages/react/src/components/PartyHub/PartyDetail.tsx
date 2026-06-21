import { useState } from "react";
import { partyTypeLabel, roleLabel } from "../../labels.js";
import {
	useAttachDocument,
	useDeleteParty,
	type CaseDocument,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { VerificationSummary } from "./VerificationSummary.js";
import { PortalThread } from "./PortalThread.js";
import { RequestComposer } from "./RequestComposer.js";
import { UploadedDocuments } from "./UploadedDocuments.js";

/** Center pane: the selected party's conversation, status, link, and documents. */
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
	const [docId, setDocId] = useState("");
	const [docRole, setDocRole] = useState(party.role || "borrower");
	const del = useDeleteParty(caseId);
	const attach = useAttachDocument(caseId);

	const linked = !!party.linked_identity_id;
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
			<header className="border-b border-slate-200 px-6 py-4 flex items-start justify-between">
				<div>
					<h2 className="text-lg font-semibold text-slate-900">{party.display_name || roleLabel(party.role)}</h2>
					<p className="text-xs text-slate-500">
						{[roleLabel(party.role), partyTypeLabel(party.party_type)].filter(Boolean).join(" · ")}
					</p>
					<div className="mt-2"><VerificationSummary party={party} /></div>
				</div>
				<div className="flex flex-col items-end gap-1 text-xs">
					<span className={linked ? "text-slate-500" : "text-amber-600"}>
						{linked ? "Linked to a case identity" : "Not linked to an identity"}
					</span>
					<span className={party.has_account ? "text-green-700" : "text-slate-400"}>
						{party.has_account ? "✓ Account created" : "No account yet"}
					</span>
				</div>
			</header>

			{/* Portal link + actions */}
			<div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-3">
				{portalUrl ? (
					<div className="flex items-center gap-2 flex-1 min-w-0">
						<input readOnly value={portalUrl} onFocus={(e) => e.currentTarget.select()} className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono" />
						<button type="button" onClick={copyLink} className="rounded-lg bg-slate-900 hover:bg-slate-700 text-white text-xs font-medium px-3 py-1.5">
							{copied ? "Copied" : "Copy link"}
						</button>
					</div>
				) : (
					<span className="text-xs text-slate-400 flex-1">Send a request to create this party's portal link.</span>
				)}
				<button type="button" onClick={remove} disabled={del.isPending} className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50">
					Remove
				</button>
			</div>

			{/* Conversation (message view) */}
			<div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
				<section>
					<h3 className="font-semibold text-slate-800 mb-2">Conversation</h3>
					<PortalThread thread={party.thread} />
				</section>

				<section>
					<h3 className="font-semibold text-slate-800 mb-2">Role on documents</h3>
					{party.documents.length > 0 ? (
						<ul className="space-y-1 mb-3">
							{party.documents.map((d) => (
								<li key={d.doc_id} className="text-sm text-slate-700">
									<span className="font-medium">{roleLabel(d.role)}</span> on {d.label}
								</li>
							))}
						</ul>
					) : (
						<p className="text-sm text-slate-400 mb-3">Not assigned to any document yet.</p>
					)}
					{caseDocuments.length > 0 && (
						<div className="flex flex-wrap gap-2 items-center">
							<select value={docId} onChange={(e) => setDocId(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
								<option value="">Choose a document…</option>
								{caseDocuments.map((d) => (
									<option key={d.doc_id} value={d.doc_id}>{d.label}</option>
								))}
							</select>
							<input value={docRole} onChange={(e) => setDocRole(e.target.value)} placeholder="role" className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
							<button
								type="button"
								onClick={() => docId && docRole.trim() && attach.mutate({ partyId: party.party_id, docId, role: docRole.trim() })}
								disabled={!docId || !docRole.trim() || attach.isPending}
								className="rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm px-3 py-1.5"
							>
								Assign
							</button>
						</div>
					)}
				</section>

				<section>
					<h3 className="font-semibold text-slate-800 mb-2">Documents shared</h3>
					<UploadedDocuments files={uploadedFiles} />
				</section>
			</div>

			{/* Composer */}
			<div className="border-t border-slate-200 px-6 py-4">
				{composing ? (
					<RequestComposer caseId={caseId} party={party} onSent={() => setComposing(false)} onCancel={() => setComposing(false)} />
				) : (
					<button
						type="button"
						onClick={() => setComposing(true)}
						disabled={!linked}
						title={linked ? undefined : "Link this party to a case identity first"}
						className="w-full rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-medium py-2.5"
					>
						+ Send request
					</button>
				)}
			</div>
		</div>
	);
}
