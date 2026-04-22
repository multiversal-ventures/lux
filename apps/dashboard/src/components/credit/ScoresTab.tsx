/**
 * ScoresTab - Detailed view of bureau scores and factors
 */

import type { CreditScore } from "./types";
import { getScoreTier, getTierLabel } from "./types";

interface ScoresTabProps {
	scores: CreditScore[];
}

function modelDisplay(model: CreditScore["scoreModel"]): string {
	switch (model) {
		case "FICO Score 8":
			return "fico_8";
		case "VantageScore 4":
			return "vantage_4";
		case "FICO Score 5":
			return "fico_5";
		case "FICO Score 4":
			return "fico_4";
		case "FICO Score 2":
			return "fico_2";
		default:
			return model;
	}
}

/** Get tier color classes */
function getTierColors(score: number): { bg: string; text: string; bar: string } {
	const tier = getScoreTier(score);
	switch (tier) {
		case "EXCEPTIONAL":
			return { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" };
		case "EXCELLENT":
			return { bg: "bg-green-50", text: "text-green-700", bar: "bg-green-500" };
		case "GOOD":
			return { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" };
		case "FAIR":
			return { bg: "bg-amber-50", text: "text-amber-700", bar: "bg-amber-500" };
		case "POOR":
			return { bg: "bg-red-50", text: "text-red-700", bar: "bg-red-500" };
	}
}

/** Score bar visualization */
function ScoreBar({ score }: { score: number }) {
	const minScore = 300;
	const maxScore = 850;
	const percentage = ((score - minScore) / (maxScore - minScore)) * 100;
	const colors = getTierColors(score);

	return (
		<div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
			<div
				className={`h-full ${colors.bar} transition-all duration-500`}
				style={{ width: `${percentage}%` }}
			/>
		</div>
	);
}

/** Single bureau score card */
function BureauScoreCard({ scoreData }: { scoreData: CreditScore }) {
	const colors = getTierColors(scoreData.score);
	const tier = getScoreTier(scoreData.score);
	const positiveFactors = scoreData.factors.filter((f) => f.impact === "POSITIVE");
	const negativeFactors = scoreData.factors.filter((f) => f.impact === "NEGATIVE");
	const primaryLabel =
		scoreData.scoreModel !== "OTHER" ? modelDisplay(scoreData.scoreModel) : scoreData.bureau;
	const secondaryLabel = scoreData.scoreModel !== "OTHER" ? scoreData.bureau : scoreData.scoreModel;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-5">
			{/* Header */}
			<div className="flex items-center gap-3 mb-4">
				<div className="flex-1">
					<h3 className="font-semibold text-slate-800">{primaryLabel}</h3>
					{secondaryLabel && <p className="text-xs text-slate-500">{secondaryLabel}</p>}
				</div>
				<div className="text-right">
					<span className="text-2xl font-bold text-slate-800">{scoreData.score}</span>
					<p className={`text-xs font-medium ${colors.text}`}>{getTierLabel(tier)}</p>
				</div>
			</div>

			{/* Score Bar */}
			<div className="mb-4">
				<ScoreBar score={scoreData.score} />
				<div className="flex justify-between text-xs text-slate-400 mt-1">
					<span>300</span>
					<span>850</span>
				</div>
			</div>

			{/* Factors */}
			{(positiveFactors.length > 0 || negativeFactors.length > 0) && (
				<div className="border-t border-slate-100 pt-4 space-y-3">
					{positiveFactors.length > 0 && (
						<div>
							<span className="text-xs font-semibold text-green-700 uppercase">
								Positive Factors
							</span>
							<ul className="mt-1 space-y-0.5">
								{positiveFactors.map((factor, idx) => (
									<li key={idx} className="text-xs text-green-600 flex items-center gap-1">
										<span>↗</span> {factor.description}
									</li>
								))}
							</ul>
						</div>
					)}
					{negativeFactors.length > 0 && (
						<div>
							<span className="text-xs font-semibold text-red-700 uppercase">Negative Factors</span>
							<ul className="mt-1 space-y-0.5">
								{negativeFactors.map((factor, idx) => (
									<li key={idx} className="text-xs text-red-600 flex items-center gap-1">
										<span>↘</span> {factor.description}
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}

			{/* Score Date */}
			<div className="mt-4 pt-3 border-t border-slate-100">
				<p className="text-xs text-slate-400">
					Score Date: {new Date(scoreData.scoreDate).toLocaleDateString()}
				</p>
			</div>
		</div>
	);
}

export function ScoresTab({ scores }: ScoresTabProps) {
	// Guard against malformed data
	if (!Array.isArray(scores)) {
		return (
			<div className="bg-amber-50 rounded-xl border border-amber-200 p-8 text-center">
				<p className="text-amber-700">Invalid score data</p>
			</div>
		);
	}

	if (scores.length === 0) {
		return (
			<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
				<p className="text-slate-500">No credit scores available</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			{scores.map((score) => (
				<BureauScoreCard
					key={`${score.bureau}-${score.scoreModel}-${score.score}`}
					scoreData={score}
				/>
			))}
		</div>
	);
}
