/**
 * Displays a pending question from the advisor.
 */

import { HelpCircle } from "lucide-react";
import type { PendingQuestion } from "./types";

interface AdvisorPendingQuestionProps {
	question: PendingQuestion;
	onSelectOption: (option: string) => void;
}

export function AdvisorPendingQuestion({ question, onSelectOption }: AdvisorPendingQuestionProps) {
	const getQuestionTitle = (type: string) => {
		switch (type) {
			case "what_if":
				return "What if...";
			case "suggestion":
				return "Suggestion";
			default:
				return "Question";
		}
	};

	return (
		<div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
			<div className="flex items-start gap-3">
				<div className="p-2 bg-blue-100 rounded-full">
					<HelpCircle className="w-5 h-5 text-blue-600" />
				</div>
				<div className="flex-1">
					<h4 className="font-medium text-blue-800 mb-2">{getQuestionTitle(question.type)}</h4>
					<p className="text-blue-700">{question.question}</p>

					{/* Quick response options */}
					{question.options.length > 0 && (
						<div className="mt-4 flex flex-wrap gap-2">
							{question.options.map((option, i) => (
								<button
									key={i}
									onClick={() => onSelectOption(option)}
									className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
								>
									{option}
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export default AdvisorPendingQuestion;
