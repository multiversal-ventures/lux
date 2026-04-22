interface ActivityFeedProps {
	recentMessages: string[];
	isComplete: boolean;
	hasNotStarted: boolean;
}

export function ActivityFeed({ recentMessages, isComplete, hasNotStarted }: ActivityFeedProps) {
	if (isComplete || hasNotStarted || recentMessages.length === 0) return null;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6">
			<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
				Recent Activity
			</h2>
			<div className="space-y-2">
				{recentMessages.slice(-5).map((msg, idx) => (
					<div key={idx} className="flex items-center gap-3 text-sm text-slate-600">
						<div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse flex-shrink-0" />
						<span>{msg}</span>
					</div>
				))}
			</div>
		</div>
	);
}
