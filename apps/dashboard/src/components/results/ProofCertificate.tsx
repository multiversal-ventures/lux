import { useState } from "react";

interface ProofCertificateProps {
	evidenceRaw?: { upper: string[]; lower: string[] };
	matchingRules?: string[];
	proofTrace?: string[];
	outcome?: string;
	ruleRef?: string;
	defaultExpanded?: boolean;
}

/**
 * Format an event name for display.
 * Converts snake_case to Title Case and makes it human-readable.
 */
function formatEventName(event: string): string {
	return event.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Collapsible proof certificate panel showing WHY a decision was made.
 * Complements CalculationLog which shows HOW values were computed.
 */
export function ProofCertificate({
	evidenceRaw,
	matchingRules,
	proofTrace,
	outcome,
	ruleRef,
	defaultExpanded = false,
}: ProofCertificateProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	// Don't render if no evidence data
	if (!evidenceRaw || (!evidenceRaw.upper?.length && !evidenceRaw.lower?.length)) {
		return null;
	}

	const trueEvents = evidenceRaw.upper || [];
	const falseEvents = evidenceRaw.lower || [];

	return (
		<div className="border-t border-slate-200">
			{/* Collapsible Header */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full px-4 py-2 flex items-center justify-between text-left bg-amber-50 hover:bg-amber-100 transition-colors"
			>
				<div className="flex items-center gap-2">
					<svg
						className={`w-4 h-4 text-amber-600 transition-transform ${isExpanded ? "rotate-90" : ""}`}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
					</svg>
					<span className="text-sm font-medium text-amber-800">Proof Certificate</span>
					<span className="text-xs text-amber-600">({trueEvents.length} conditions met)</span>
				</div>
				<span className="text-xs text-amber-600">
					{isExpanded ? "Hide" : "Show"} decision logic
				</span>
			</button>

			{/* Certificate Content */}
			{isExpanded && (
				<div className="px-4 py-3 bg-amber-50/50 space-y-3">
					{/* Evidence Section */}
					<div className="p-3 rounded-lg border border-amber-200 bg-white">
						<div className="text-[10px] uppercase text-amber-600 font-semibold mb-2">
							Evidence (from documents)
						</div>
						<div className="space-y-1">
							{trueEvents.map((event) => (
								<div key={event} className="flex items-center gap-2 text-sm">
									<span className="text-green-600 font-bold">✓</span>
									<span className="text-slate-700">{formatEventName(event)}</span>
								</div>
							))}
							{falseEvents.map((event) => (
								<div key={event} className="flex items-center gap-2 text-sm">
									<span className="text-slate-400 font-bold">✗</span>
									<span className="text-slate-400">{formatEventName(event)}</span>
								</div>
							))}
						</div>
					</div>

					{/* Rule Matched Section */}
					{proofTrace && proofTrace.length > 0 && (
						<div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
							<div className="text-[10px] uppercase text-blue-600 font-semibold mb-2">
								Rule Matched
							</div>
							{proofTrace.map((trace, idx) => (
								<div key={idx} className="text-sm text-blue-800 font-medium">
									{trace}
								</div>
							))}
							{ruleRef && <div className="mt-1 text-xs text-blue-600">Citation: {ruleRef}</div>}
						</div>
					)}

					{/* Outcome Section */}
					{outcome && (
						<div className="p-3 rounded-lg border border-green-200 bg-green-50">
							<div className="text-[10px] uppercase text-green-600 font-semibold mb-1">Outcome</div>
							<div className="text-sm text-green-800 font-semibold">{formatEventName(outcome)}</div>
						</div>
					)}

					{/* T-Object Debug (collapsed by default) */}
					{matchingRules && matchingRules.length > 0 && (
						<details className="text-xs text-slate-400">
							<summary className="cursor-pointer hover:text-slate-600">
								T-Object Details (debug)
							</summary>
							<div className="mt-2 p-2 bg-slate-100 rounded font-mono overflow-x-auto">
								{matchingRules.map((rule, idx) => (
									<div key={idx}>{rule}</div>
								))}
							</div>
						</details>
					)}
				</div>
			)}
		</div>
	);
}
