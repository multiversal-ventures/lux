/**
 * Single stream of advisor messages: analysis events + result sections.
 * Renders events and (when complete) result blocks as one chronological feed.
 */

import { forwardRef } from "react";
import { FileText, TrendingUp, List, AlertCircle, HelpCircle, Wand2 } from "lucide-react";
import type { AdvisorEvent, AdvisorResult as AdvisorResultType, ProposedScenario } from "./types";
import { getEventIcon, renderEventContent } from "./AdvisorEventLog";
import { AdvisorStrategy } from "./AdvisorStrategy";
import { AdvisorProposedScenario } from "./AdvisorProposedScenario";

interface AdvisorStreamProps {
	events: AdvisorEvent[];
	result?: AdvisorResultType;
	proposedScenario?: ProposedScenario;
	/** Show spinner + "Analyzing..." above stream when true */
	isAnalyzing?: boolean;
}

function StreamMessage({
	icon,
	children,
	className = "",
}: {
	icon: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`flex items-start gap-3 ${className}`}>
			<div className="shrink-0 mt-0.5">{icon}</div>
			<div className="flex-1 min-w-0 text-sm">{children}</div>
		</div>
	);
}

export const AdvisorStream = forwardRef<HTMLDivElement, AdvisorStreamProps>(function AdvisorStream(
	{ events, result, proposedScenario, isAnalyzing = false },
	ref,
) {
	const hasContent = events.length > 0 || result;

	if (!hasContent && !isAnalyzing) return null;

	return (
		<div className="space-y-3">
			{isAnalyzing && (
				<StreamMessage icon={<Wand2 className="w-4 h-4 text-purple-500 animate-pulse" />}>
					<span className="text-slate-600 font-medium">Analyzing case data...</span>
				</StreamMessage>
			)}

			{/* Analysis events */}
			{events.map((event, i) => (
				<StreamMessage key={`ev-${i}`} icon={getEventIcon(event.type)}>
					{renderEventContent(event)}
				</StreamMessage>
			))}

			{/* Result sections as stream messages */}
			{result && (
				<>
					{/* Case Summary */}
					<StreamMessage
						icon={<FileText className="w-4 h-4 text-slate-500" />}
						className="bg-slate-50 rounded-lg p-3 -m-1"
					>
						<h3 className="text-sm font-semibold text-slate-700 mb-1.5">Case Summary</h3>
						<p className="text-slate-600 whitespace-pre-line">
							{result.case_summary || "Analysis complete."}
						</p>
					</StreamMessage>

					{/* Primary Strategy */}
					{result.primary_strategy && (
						<div className="flex items-start gap-3">
							<div className="shrink-0 mt-0.5">
								<TrendingUp className="w-4 h-4 text-blue-500" />
							</div>
							<div className="flex-1 min-w-0">
								<AdvisorStrategy strategy={result.primary_strategy} isPrimary />
							</div>
						</div>
					)}

					{/* Alternative Strategies */}
					{(result.alternative_strategies?.length ?? 0) > 0 && (
						<StreamMessage
							icon={<List className="w-4 h-4 text-slate-500" />}
							className="bg-slate-50 rounded-lg p-3 -m-1"
						>
							<h3 className="text-sm font-semibold text-slate-700 mb-2">Alternative Strategies</h3>
							<div className="space-y-2">
								{result.alternative_strategies!.map((strategy, i) => (
									<AdvisorStrategy key={i} strategy={strategy} />
								))}
							</div>
						</StreamMessage>
					)}

					{/* Proposed Scenario CTA */}
					{proposedScenario && (
						<div className="flex items-start gap-3">
							<div className="shrink-0 mt-0.5">
								<Wand2 className="w-4 h-4 text-green-500" />
							</div>
							<div className="flex-1 min-w-0">
								<AdvisorProposedScenario scenario={proposedScenario} />
							</div>
						</div>
					)}

					{/* Observations */}
					{(result.observations?.length ?? 0) > 0 && (
						<StreamMessage
							icon={<HelpCircle className="w-4 h-4 text-slate-500" />}
							className="bg-slate-50 rounded-lg p-3 -m-1"
						>
							<h3 className="text-sm font-semibold text-slate-700 mb-1.5">Key Observations</h3>
							<ul className="space-y-1">
								{result.observations!.map((obs, i) => (
									<li key={i} className="text-slate-600 flex items-start gap-2">
										<span className="text-slate-400">•</span>
										{obs}
									</li>
								))}
							</ul>
						</StreamMessage>
					)}

					{/* Data Gaps */}
					{(result.data_gaps?.length ?? 0) > 0 && (
						<StreamMessage
							icon={<AlertCircle className="w-4 h-4 text-amber-500" />}
							className="bg-amber-50/50 rounded-lg p-3 -m-1"
						>
							<h3 className="text-sm font-semibold text-slate-700 mb-1.5">Missing Documents</h3>
							<ul className="space-y-1">
								{result.data_gaps!.map((gap, i) => (
									<li key={i} className="text-slate-600 flex items-start gap-2">
										<FileText className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
										{gap}
									</li>
								))}
							</ul>
						</StreamMessage>
					)}

					{/* Tools used - subtle footer */}
					{(result.tools_used?.length ?? 0) > 0 && (
						<div className="text-xs text-slate-400 pt-1 border-t border-slate-100">
							Analyzed using {result.tools_called ?? result.tools_used!.length} tool calls:{" "}
							{result.tools_used!.join(", ")}
						</div>
					)}
				</>
			)}

			<div ref={ref} />
		</div>
	);
});

export default AdvisorStream;
