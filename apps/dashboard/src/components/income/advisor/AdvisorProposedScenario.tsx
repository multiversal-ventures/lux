/**
 * Displays a proposed scenario from the advisor.
 */

import { TrendingUp, Wand2 } from "lucide-react";
import type { ProposedScenario } from "./types";

interface AdvisorProposedScenarioProps {
	scenario: ProposedScenario;
	compact?: boolean;
}

export function AdvisorProposedScenario({
	scenario,
	compact = false,
}: AdvisorProposedScenarioProps) {
	if (compact) {
		return (
			<div className="bg-green-50 border border-green-200 rounded-lg p-3">
				<div className="flex items-center gap-2 text-green-700">
					<TrendingUp className="w-4 h-4" />
					<span className="font-medium text-sm">Proposed: {scenario.name}</span>
				</div>
			</div>
		);
	}

	const handleCreate = () => {
		const params = new URLSearchParams({
			name: scenario.name,
			approach: scenario.approach,
		});
		window.location.href = `${scenario.action_url}?${params}`;
	};

	return (
		<div className="bg-green-50 border border-green-200 rounded-lg p-4">
			<div className="flex items-start gap-3">
				<div className="p-2 bg-green-100 rounded-full">
					<TrendingUp className="w-5 h-5 text-green-600" />
				</div>
				<div className="flex-1">
					<h4 className="font-semibold text-green-800">Proposed Scenario: {scenario.name}</h4>
					<p className="mt-1 text-sm text-green-700">{scenario.explanation}</p>

					{/* Scenario details */}
					<div className="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div>
							<span className="text-green-600">Approach:</span>{" "}
							<span className="font-medium text-green-800">
								{scenario.approach === "non_qualified_mortgage" ? "Non-QM" : "QM"}
							</span>
						</div>
						<div>
							<span className="text-green-600">Years:</span>{" "}
							<span className="font-medium text-green-800">{scenario.year_selection}</span>
						</div>
					</div>

					{/* Document/borrower filters */}
					{(scenario.document_types.length > 0 || scenario.borrower_names.length > 0) && (
						<div className="mt-3 text-xs text-green-600">
							{scenario.document_types.length > 0 && (
								<div>Documents: {scenario.document_types.join(", ")}</div>
							)}
							{scenario.borrower_names.length > 0 && (
								<div>Borrowers: {scenario.borrower_names.join(", ")}</div>
							)}
						</div>
					)}

					{/* Create Scenario button */}
					<button
						onClick={handleCreate}
						className="mt-4 w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
					>
						<Wand2 className="w-4 h-4" />
						Create This Scenario
					</button>
				</div>
			</div>
		</div>
	);
}

export default AdvisorProposedScenario;
