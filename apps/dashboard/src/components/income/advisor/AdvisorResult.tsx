/**
 * Displays the complete advisor result.
 */

import { FileText } from "lucide-react";
import { AdvisorProposedScenario } from "./AdvisorProposedScenario";
import { AdvisorStrategy } from "./AdvisorStrategy";
import type { AdvisorResult as AdvisorResultType, ProposedScenario } from "./types";

interface AdvisorResultProps {
	result: AdvisorResultType;
	proposedScenario?: ProposedScenario;
}

export function AdvisorResultDisplay({ result, proposedScenario }: AdvisorResultProps) {
	// Handle potentially malformed or partial results
	const caseSummary = result?.case_summary || "Analysis complete.";
	const observations = result?.observations || [];
	const dataGaps = result?.data_gaps || [];
	const toolsUsed = result?.tools_used || [];
	const toolsCalled = result?.tools_called || toolsUsed.length || 0;
	const alternatives = result?.alternative_strategies || [];

	return (
		<div className="space-y-6">
			{/* Case Summary */}
			<div>
				<h3 className="text-sm font-semibold text-slate-700 mb-2">Case Summary</h3>
				<p className="text-sm text-slate-600 whitespace-pre-line">{caseSummary}</p>
			</div>

			{/* Primary Strategy */}
			{result?.primary_strategy && <AdvisorStrategy strategy={result.primary_strategy} isPrimary />}

			{/* Alternative Strategies */}
			{alternatives.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-slate-700 mb-3">Alternative Strategies</h3>
					<div className="space-y-2">
						{alternatives.map((strategy, i) => (
							<AdvisorStrategy key={i} strategy={strategy} />
						))}
					</div>
				</div>
			)}

			{/* Proposed Scenario - Call to Action */}
			{proposedScenario && <AdvisorProposedScenario scenario={proposedScenario} />}

			{/* Observations */}
			{observations.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-slate-700 mb-2">Key Observations</h3>
					<ul className="space-y-1">
						{observations.map((obs, i) => (
							<li key={i} className="text-sm text-slate-600 flex items-start gap-2">
								<span className="text-slate-400">•</span>
								{obs}
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Data Gaps */}
			{dataGaps.length > 0 && (
				<div>
					<h3 className="text-sm font-semibold text-slate-700 mb-2">Missing Documents</h3>
					<ul className="space-y-1">
						{dataGaps.map((gap, i) => (
							<li key={i} className="text-sm text-slate-600 flex items-start gap-2">
								<FileText className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
								{gap}
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Tools Used - only show if we have data */}
			{toolsUsed.length > 0 && (
				<div className="text-xs text-slate-400 pt-2 border-t border-slate-100">
					Analyzed using {toolsCalled} tool calls: {toolsUsed.join(", ")}
				</div>
			)}
		</div>
	);
}

export default AdvisorResultDisplay;
