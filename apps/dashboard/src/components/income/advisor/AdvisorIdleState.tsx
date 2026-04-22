/**
 * Displays the idle state with suggested prompts.
 */

import { Wand2 } from "lucide-react";

interface AdvisorIdleStateProps {
	onSelectPrompt: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
	"What are some strategies we can explore?",
	"What if we use bank statements?",
	"Can we add back depreciation?",
];

export function AdvisorIdleState({ onSelectPrompt }: AdvisorIdleStateProps) {
	return (
		<div className="space-y-4">
			<div className="text-center py-6">
				<Wand2 className="w-10 h-10 text-purple-300 mx-auto mb-3" />
				<p className="text-slate-500 text-sm max-w-sm mx-auto">
					Ask a question about optimizing income, or start exploring scenarios.
				</p>
			</div>

			{/* Suggested prompts */}
			<div className="flex flex-wrap gap-2 justify-center">
				{SUGGESTED_PROMPTS.map((prompt) => (
					<button
						key={prompt}
						onClick={() => onSelectPrompt(prompt)}
						className="px-3 py-1.5 text-xs text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-full transition-colors"
					>
						{prompt}
					</button>
				))}
			</div>
		</div>
	);
}

export default AdvisorIdleState;
