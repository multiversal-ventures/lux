import logoOrange from "../../assets/logo-orange.svg";
import type { Tier4ReviewState } from "../../types";

interface ValidationProgressProps {
	reviewState: Tier4ReviewState;
	currentPhase: string;
	isRulesComplete: boolean;
	isLlmComplete: boolean;
	isPartiesComplete: boolean;
}

export function ValidationProgress({
	reviewState,
	currentPhase,
	isRulesComplete,
	isLlmComplete,
	isPartiesComplete,
}: ValidationProgressProps) {
	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
			<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
				Validation Progress
			</h2>
			<div className="flex items-center justify-between max-w-xl mx-auto">
				<ProgressStep
					label="Rules"
					isActive={currentPhase === "rules" || currentPhase === "started"}
					isComplete={isRulesComplete}
					count={reviewState.rulesChecked > 0 ? reviewState.rulesChecked : undefined}
				/>
				<ProgressConnector isActive={isRulesComplete} />
				<ProgressStep
					label="Fenero Agent"
					isActive={currentPhase === "llm"}
					isComplete={isLlmComplete}
					isSkipped={isPartiesComplete && !reviewState.llmReviewPerformed}
					icon={<img src={logoOrange} alt="Fenero" className="w-5 h-5" />}
				/>
				<ProgressConnector isActive={isLlmComplete} />
				<ProgressStep
					label="Parties"
					isActive={currentPhase === "parties" && !isPartiesComplete}
					isComplete={isPartiesComplete}
					count={reviewState.partiesFound > 0 ? reviewState.partiesFound : undefined}
				/>
			</div>
		</div>
	);
}

interface ProgressStepProps {
	label: string;
	isActive: boolean;
	isComplete: boolean;
	isSkipped?: boolean;
	count?: number;
	icon?: React.ReactNode;
}

function ProgressStep({ label, isActive, isComplete, isSkipped, count, icon }: ProgressStepProps) {
	return (
		<div className="flex flex-col items-center min-w-[100px]">
			<div
				className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all shadow-sm ${
					isComplete
						? "bg-green-500 text-white ring-2 ring-green-200"
						: isActive
							? "bg-orange-500 text-white ring-2 ring-orange-200"
							: isSkipped
								? "bg-slate-200 text-slate-400"
								: "bg-slate-100 text-slate-400 border border-slate-200"
				}`}
			>
				{isComplete ? (
					<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2.5}
							d="M5 13l4 4L19 7"
						/>
					</svg>
				) : isActive ? (
					<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
				) : isSkipped ? (
					<span className="text-sm">—</span>
				) : icon ? (
					icon
				) : (
					<span className="text-sm">{count ?? "•"}</span>
				)}
			</div>
			<span
				className={`mt-2 text-sm font-medium ${
					isComplete
						? "text-green-700"
						: isActive
							? "text-orange-700"
							: isSkipped
								? "text-slate-400"
								: "text-slate-500"
				}`}
			>
				{label}
			</span>
			{count !== undefined && isComplete && (
				<span className="text-xs text-slate-400">{count} checked</span>
			)}
		</div>
	);
}

function ProgressConnector({ isActive }: { isActive: boolean }) {
	return (
		<div className="flex-1 flex items-center px-3">
			<div
				className={`w-full h-1 rounded-full transition-colors ${isActive ? "bg-green-300" : "bg-slate-200"}`}
			/>
		</div>
	);
}
