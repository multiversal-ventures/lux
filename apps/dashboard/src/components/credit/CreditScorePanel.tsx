/**
 * CreditScorePanel - Displays representative score with donut chart and bureau scores
 */

import type { CreditScore } from "./types";
import { getScoreTier, getTierLabel } from "./types";

interface CreditScorePanelProps {
	scores: CreditScore[];
}

/** Get the representative (median) score from bureau scores */
function getRepresentativeScore(scores: CreditScore[]): number {
	if (scores.length === 0) return 0;
	const sorted = [...scores].map((s) => s.score).sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Get color classes based on score tier */
function getTierColors(score: number): { ring: string; text: string; bg: string } {
	const tier = getScoreTier(score);
	switch (tier) {
		case "EXCEPTIONAL":
			return { ring: "stroke-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" };
		case "EXCELLENT":
			return { ring: "stroke-orange-500", text: "text-orange-500", bg: "bg-orange-50" };
		case "GOOD":
			return { ring: "stroke-blue-500", text: "text-blue-600", bg: "bg-blue-50" };
		case "FAIR":
			return { ring: "stroke-amber-500", text: "text-amber-600", bg: "bg-amber-50" };
		case "POOR":
			return { ring: "stroke-red-500", text: "text-red-600", bg: "bg-red-50" };
	}
}

/** Donut chart SVG component */
function ScoreDonut({ score, size = 160 }: { score: number; size?: number }) {
	const colors = getTierColors(score);
	const tier = getScoreTier(score);
	const label = getTierLabel(tier);

	// SVG circle math
	const strokeWidth = 12;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;

	// Score range: 300-850
	const minScore = 300;
	const maxScore = 850;
	const percentage = Math.min(Math.max((score - minScore) / (maxScore - minScore), 0), 1);
	const dashOffset = circumference * (1 - percentage);

	const center = size / 2;

	return (
		<div className="relative" style={{ width: size, height: size }}>
			<svg width={size} height={size} className="transform -rotate-90">
				{/* Background circle */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					stroke="#e2e8f0"
					strokeWidth={strokeWidth}
				/>
				{/* Score arc */}
				<circle
					cx={center}
					cy={center}
					r={radius}
					fill="none"
					className={colors.ring}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={dashOffset}
					style={{ transition: "stroke-dashoffset 0.5s ease-in-out" }}
				/>
			</svg>
			{/* Center content */}
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="text-4xl font-bold text-slate-800">{score}</span>
				<span className={`text-sm font-medium ${colors.text}`}>{label}</span>
			</div>
		</div>
	);
}

/** Bureau score row */
function BureauScoreRow({ bureau, score }: { bureau: string; score: number }) {
	return (
		<div className="flex items-center justify-between text-sm">
			<span className="text-slate-500">{bureau}</span>
			<span className="font-semibold text-slate-700">{score}</span>
		</div>
	);
}

export function CreditScorePanel({ scores }: CreditScorePanelProps) {
	const representativeScore = getRepresentativeScore(scores);

	// Find scores by bureau
	const equifaxScore = scores.find((s) => s.bureau === "Equifax")?.score ?? 0;
	const experianScore = scores.find((s) => s.bureau === "Experian")?.score ?? 0;
	const transunionScore = scores.find((s) => s.bureau === "TransUnion")?.score ?? 0;

	return (
		<div className="select-none bg-white rounded-xl border border-slate-200 p-6">
			<div className="text-center mb-4">
				<span className="text-sm text-slate-500">Representative Score</span>
			</div>

			{/* Donut Chart */}
			<div className="flex justify-center mb-6">
				<ScoreDonut score={representativeScore} size={160} />
			</div>

			{/* Bureau Scores */}
			<div className="space-y-2 pt-4 border-t border-slate-100">
				<BureauScoreRow bureau="Equifax" score={equifaxScore} />
				<BureauScoreRow bureau="Experian" score={experianScore} />
				<BureauScoreRow bureau="TransUnion" score={transunionScore} />
			</div>
		</div>
	);
}
