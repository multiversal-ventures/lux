import { useNavigate } from "react-router-dom";
import type { Party, FinancialEntities } from "../../types";

type PartyWithId = Party & { _id: string };
type BorrowerRole = "Primary" | "Co-borrower" | "Ignore";

function getRoleForParty(
	party: PartyWithId,
	financialEntities: FinancialEntities | null | undefined,
): BorrowerRole | "—" {
	if (!financialEntities) return "—";
	const nameUpper = String(party.name).toUpperCase();
	for (const b of financialEntities.borrowers ?? []) {
		if (b.canonical_name === nameUpper) {
			if (b.borrower_role === "primary") return "Primary";
			if (b.borrower_role === "co_borrower") return "Co-borrower";
			return "—";
		}
		if ((b.name_aliases ?? []).some((a) => a.toUpperCase() === nameUpper)) {
			if (b.borrower_role === "primary") return "Primary";
			if (b.borrower_role === "co_borrower") return "Co-borrower";
			return "—";
		}
	}
	if ((financialEntities.ignored_party_names ?? []).some((n) => n.toUpperCase() === nameUpper)) {
		return "Ignore";
	}
	return "—";
}

function formatIdentifierValue(key: string, value: unknown): string {
	if (value === null || value === undefined) return "N/A";
	const str = typeof value === "string" ? value : String(value);
	const keyLower = key.toLowerCase();
	if (keyLower.includes("ssn") || keyLower === "social_security") {
		if (str.includes("X") || str.includes("*")) return str;
		const digits = str.replace(/\D/g, "");
		if (digits.length >= 9) return `***-**-${digits.slice(-4)}`;
	}
	return str;
}

function formatIdentifiers(identifiers: Record<string, string> | undefined): string {
	if (!identifiers || Object.keys(identifiers).length === 0) return "—";
	return Object.entries(identifiers)
		.map(([k, v]) => `${k}: ${formatIdentifierValue(k, v)}`)
		.join(", ");
}

function partyNameDisplay(party: PartyWithId): string {
	const n = party.name;
	if (typeof n === "string") return n || "Unknown";
	if (n && typeof n === "object" && "name" in n)
		return String((n as { name?: string }).name ?? "Unknown");
	return String(n ?? "Unknown");
}

interface PartiesSummaryProps {
	parties: PartyWithId[];
	caseId: string;
	/** Optional; used to show Role column */
	financialEntities?: FinancialEntities | null;
	/** When set, "Create Scenario" calls this instead of navigating to /new-scenario */
	onOpenParties?: () => void;
}

/**
 * PartiesSummary - Read-only Excel-like table of parties with "Open Parties" button.
 */
export function PartiesSummary({
	parties,
	caseId,
	financialEntities,
	onOpenParties,
}: PartiesSummaryProps) {
	const navigate = useNavigate();
	const partiesWithRole = parties.filter(
		(party) => getRoleForParty(party, financialEntities ?? null) !== "—",
	);

	if (partiesWithRole.length === 0) {
		return (
			<div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
				<div className="p-6 text-center text-slate-500">
					<p className="font-medium">No parties identified</p>
					<p className="text-sm mt-1">Parties are extracted from uploaded documents</p>
				</div>
			</div>
		);
	}

	return (
		<div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
			<div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
				<h3 className="text-sm font-semibold text-slate-700">Parties</h3>
				<button
					type="button"
					onClick={onOpenParties ?? (() => navigate(`/case/${caseId}/new-scenario`))}
					className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
				>
					Create Scenario
				</button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="bg-slate-100 border-b border-slate-200">
							<th className="text-left py-2 px-3 font-semibold text-slate-700 border-r border-slate-200">
								Name
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700 border-r border-slate-200">
								Role
							</th>
							<th className="text-left py-2 px-3 font-semibold text-slate-700">Identifiers</th>
						</tr>
					</thead>
					<tbody>
						{partiesWithRole.map((party, i) => (
							<tr key={party._id ?? i} className="border-b border-slate-100 hover:bg-slate-50">
								<td className="py-2 px-3 text-slate-800 border-r border-slate-100">
									{partyNameDisplay(party)}
								</td>
								<td className="py-2 px-3 text-slate-700 border-r border-slate-100">
									{getRoleForParty(party, financialEntities ?? null)}
								</td>
								<td className="py-2 px-3 text-slate-600 font-mono text-xs">
									{formatIdentifiers(party.identifiers)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
