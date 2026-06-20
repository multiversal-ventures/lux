import type { PartyView } from "../../hooks/usePartyHub.js";

/** Identity + consent status for a party, in plain language. */
export function VerificationSummary({ party }: { party: PartyView }) {
	return (
		<div className="flex flex-wrap gap-3">
			<Badge ok={party.verified} label="Identity verified" pending="Identity not verified" />
			<Badge ok={party.signed} label="Consent signed" pending="Consent not signed" />
		</div>
	);
}

function Badge({ ok, label, pending }: { ok: boolean; label: string; pending: string }) {
	return (
		<span className={`inline-flex items-center gap-1 text-xs ${ok ? "text-green-700" : "text-slate-400"}`}>
			<span aria-hidden>{ok ? "✓" : "○"}</span>
			{ok ? label : pending}
		</span>
	);
}
