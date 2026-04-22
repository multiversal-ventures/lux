/**
 * Displays context usage indicator.
 */

interface AdvisorContextBarProps {
	contextTokens: number;
	maxTokens?: number;
}

export function AdvisorContextBar({ contextTokens, maxTokens = 128000 }: AdvisorContextBarProps) {
	const percentage = Math.min(100, (contextTokens / maxTokens) * 100);
	const isWarning = contextTokens > 50000;
	const isDanger = contextTokens > 100000;

	return (
		<div className="flex items-center justify-between text-xs text-slate-400">
			<div className="flex items-center gap-2">
				<span className="text-slate-300">context</span>
				<div className="flex items-center gap-1.5">
					<div className="relative w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
						<div
							className={`absolute left-0 top-0 h-full rounded-full transition-all ${
								isDanger ? "bg-red-400" : isWarning ? "bg-amber-400" : "bg-slate-400"
							}`}
							style={{ width: `${percentage}%` }}
						/>
					</div>
					<span>{Math.round(percentage)}% used</span>
				</div>
			</div>
		</div>
	);
}

export default AdvisorContextBar;
