import { roleLabel } from "../../labels.js";
import {
	usePortalOverview,
	usePortalCandidates,
	useAddParty,
	type PartyCandidate,
} from "../../hooks/usePartyHub.js";
import { PartyCard } from "./PartyCard.js";
import { UploadedDocuments } from "./UploadedDocuments.js";

export interface PartyHubProps {
	caseId: string;
	className?: string;
}

/**
 * Operator Party Hub — the people/entities on a case, each with their
 * verification status, conversation, and document requests, plus the shared
 * uploaded documents. Composed entirely from lux pieces; hosts mount it at a route.
 */
export function PartyHub({ caseId, className }: PartyHubProps) {
	const overview = usePortalOverview(caseId);
	const candidates = usePortalCandidates(caseId);
	const addParty = useAddParty(caseId);

	if (overview.isLoading) {
		return <div className={wrap(className)}><p className="text-slate-500">Loading…</p></div>;
	}
	if (overview.error || !overview.data) {
		return (
			<div className={wrap(className)}>
				<p className="text-sm text-red-600">{overview.error?.message ?? "Couldn't load this case's parties."}</p>
			</div>
		);
	}

	const parties = overview.data.parties;
	const unlinked = (candidates.data ?? []) as PartyCandidate[];

	function add(c: PartyCandidate) {
		addParty.mutate({
			party_type: c.party_type ?? "individual",
			role: c.role ?? null,
			display_name: c.display_name ?? null,
			linked_identity_id: c.identity_id ?? null,
		});
	}

	return (
		<div className={wrap(className)}>
			<header className="mb-6">
				<h1 className="text-xl font-semibold text-slate-900">People on this case</h1>
				<p className="text-sm text-slate-500">
					Request documents, track identity verification, and see what each person has shared.
				</p>
			</header>

			{unlinked.length > 0 && (
				<div className="mb-6 bg-slate-50 border border-slate-200 rounded-xl p-4">
					<p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Add from this case</p>
					<div className="flex flex-wrap gap-2">
						{unlinked.map((c) => (
							<button
								key={c.identity_id}
								type="button"
								onClick={() => add(c)}
								disabled={addParty.isPending}
								className="rounded-full bg-white border border-slate-300 hover:bg-slate-100 text-sm px-3 py-1.5 disabled:opacity-50"
							>
								+ {c.display_name || roleLabel(c.role)}
							</button>
						))}
					</div>
				</div>
			)}

			<div className="space-y-4">
				{parties.length === 0 ? (
					<p className="text-sm text-slate-400">No one added yet — add a person from this case above.</p>
				) : (
					parties.map((p) => <PartyCard key={p.party_id} caseId={caseId} party={p} />)
				)}
			</div>

			<section className="mt-8">
				<h2 className="font-semibold text-slate-800 mb-2">Documents shared</h2>
				<UploadedDocuments files={overview.data.uploaded_files} />
			</section>
		</div>
	);
}

function wrap(className?: string): string {
	return `max-w-3xl mx-auto p-6${className ? ` ${className}` : ""}`;
}
