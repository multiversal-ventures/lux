/**
 * Displays a single income strategy recommendation.
 */

import { TrendingUp, ChevronRight, CheckCircle, AlertTriangle } from "lucide-react";
import type { IncomeStrategy } from "../../../hooks/useApi";
import type { SourceReference } from "./types";

interface AdvisorStrategyProps {
	strategy: IncomeStrategy & { sources?: SourceReference[] };
	isPrimary?: boolean;
}

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
	}).format(amount);
}

export function AdvisorStrategy({ strategy, isPrimary = false }: AdvisorStrategyProps) {
	if (isPrimary) {
		return (
			<div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
				<div className="flex items-center gap-2 mb-3">
					<TrendingUp className="w-5 h-5 text-blue-600" />
					<h3 className="font-semibold text-blue-800">Primary Recommendation</h3>
				</div>

				<h4 className="font-medium text-slate-800 text-lg">{strategy.strategy_name}</h4>

				<div className="mt-3 flex items-center gap-4 text-sm">
					<div>
						<span className="text-slate-500">Current:</span>{" "}
						<span className="font-medium text-slate-700">
							{formatCurrency(strategy.current_income)}/mo
						</span>
					</div>
					<ChevronRight className="w-4 h-4 text-slate-400" />
					<div>
						<span className="text-slate-500">Estimated:</span>{" "}
						<span className="font-medium text-green-600">
							{formatCurrency(strategy.estimated_income)}/mo
						</span>
					</div>
					<span
						className={`px-2 py-0.5 rounded text-xs font-medium ${
							strategy.impact_percent >= 0
								? "bg-green-100 text-green-700"
								: "bg-red-100 text-red-700"
						}`}
					>
						{strategy.impact_percent >= 0 ? "+" : ""}
						{strategy.impact_percent.toFixed(0)}%
					</span>
				</div>

				<p className="mt-3 text-sm text-slate-600">{strategy.reasoning}</p>

				<div className="mt-4 grid grid-cols-2 gap-4 text-sm">
					<div>
						<span className="text-slate-500">Confidence:</span>{" "}
						<span className="font-medium">{(strategy.confidence * 100).toFixed(0)}%</span>
					</div>
					<div>
						<span className="text-slate-500">Risk:</span>{" "}
						<span
							className={`font-medium capitalize ${
								strategy.risk_level === "low"
									? "text-green-600"
									: strategy.risk_level === "medium"
										? "text-amber-600"
										: "text-red-600"
							}`}
						>
							{strategy.risk_level}
						</span>
					</div>
				</div>

				{strategy.requirements.length > 0 && (
					<div className="mt-4">
						<span className="text-xs font-medium text-slate-500 uppercase">Requirements</span>
						<ul className="mt-1 space-y-1">
							{strategy.requirements.map((req, i) => (
								<li key={i} className="text-sm text-slate-600 flex items-start gap-2">
									<CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
									{req}
								</li>
							))}
						</ul>
					</div>
				)}

				{strategy.trade_offs.length > 0 && (
					<div className="mt-4">
						<span className="text-xs font-medium text-slate-500 uppercase">Trade-offs</span>
						<ul className="mt-1 space-y-1">
							{strategy.trade_offs.map((to, i) => (
								<li key={i} className="text-sm text-slate-600 flex items-start gap-2">
									<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
									{to}
								</li>
							))}
						</ul>
					</div>
				)}

				{/* Why Section - Sources */}
				{strategy.sources && strategy.sources.length > 0 && (
					<div className="mt-4 bg-slate-50 rounded-lg p-3">
						<span className="text-xs font-medium text-slate-500 uppercase">Why this works</span>
						<ul className="mt-2 space-y-2">
							{strategy.sources.map((source, i) => (
								<li key={i} className="text-sm">
									<div className="flex items-start gap-2">
										<span
											className={`px-1.5 py-0.5 text-xs rounded font-medium ${
												source.type === "spec"
													? "bg-purple-100 text-purple-700"
													: source.type === "document"
														? "bg-blue-100 text-blue-700"
														: "bg-green-100 text-green-700"
											}`}
										>
											{source.type}
										</span>
										<div>
											<span className="font-medium text-slate-700">{source.name}</span>
											{source.detail && (
												<p className="text-slate-500 text-xs mt-0.5">{source.detail}</p>
											)}
										</div>
									</div>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		);
	}

	// Compact alternative strategy card
	return (
		<div className="bg-slate-50 rounded-lg p-3">
			<div className="flex items-center justify-between">
				<span className="font-medium text-slate-700">{strategy.strategy_name}</span>
				<span
					className={`text-sm font-medium ${
						strategy.impact_delta >= 0 ? "text-green-600" : "text-red-600"
					}`}
				>
					{strategy.impact_delta >= 0 ? "+" : ""}
					{formatCurrency(strategy.impact_delta)}/mo
				</span>
			</div>
			<p className="mt-1 text-sm text-slate-500">{strategy.reasoning.slice(0, 150)}...</p>
		</div>
	);
}

export default AdvisorStrategy;
