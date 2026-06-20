import { useState } from "react";
import { partyTypeLabel, roleLabel } from "../../labels.js";
import type { PartyView } from "../../hooks/usePartyHub.js";
import { VerificationSummary } from "./VerificationSummary.js";
import { PortalThread } from "./PortalThread.js";
import { RequestComposer } from "./RequestComposer.js";

/** One party in the hub: who they are, their status, conversation, and a way to send a request. */
export function PartyCard({ caseId, party }: { caseId: string; party: PartyView }) {
	const [composing, setComposing] = useState(false);

	const linked = !!party.linked_identity_id;
	const subtitle = [roleLabel(party.role), partyTypeLabel(party.party_type)].filter(Boolean).join(" · ");

	return (
		<div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
			<div className="flex items-start justify-between">
				<div>
					<h3 className="font-semibold text-slate-900">{party.display_name || roleLabel(party.role)}</h3>
					<p className="text-xs text-slate-500">{subtitle}</p>
				</div>
				<span className={`text-xs ${linked ? "text-slate-500" : "text-amber-600"}`}>
					{linked ? "Linked to a case identity" : "Not linked to an identity"}
				</span>
			</div>

			<VerificationSummary party={party} />

			<details>
				<summary className="text-xs font-medium text-slate-500 cursor-pointer">
					Conversation ({party.thread.length})
				</summary>
				<div className="mt-2">
					<PortalThread thread={party.thread} />
				</div>
			</details>

			{composing ? (
				<RequestComposer caseId={caseId} party={party} onSent={() => setComposing(false)} onCancel={() => setComposing(false)} />
			) : (
				<button
					type="button"
					onClick={() => setComposing(true)}
					disabled={!linked}
					title={linked ? undefined : "Link this party to a case identity first"}
					className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed"
				>
					+ Send request
				</button>
			)}
		</div>
	);
}
