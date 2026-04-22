import { useQueries } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getIncomeVerification, listRefinements } from "../hooks/useApi";
import { caseKeys, useCaseScenarios } from "../hooks/useCaseQueries";

interface ComparePageProps {
	caseId: string;
}

interface CompareRow {
	key: string;
	loanProduct: string;
	qualifyingIncome: number | null;
	calcPeriod: string;
	trend: string;
	sourceScenarioName: string;
	sourceHref: string | null;
	trendKey: "increasing" | "stable" | "declining" | "unknown";
}

const LOAN_PRODUCT_CONFIG: Record<string, { label: string }> = {
	fannie_mae: { label: "Fannie Mae" },
	freddie_mac: { label: "Freddie Mac" },
	fha: { label: "FHA" },
	usda: { label: "USDA" },
	va: { label: "VA" },
	non_qm_bank_statement: { label: "Bank Statement (Non-QM)" },
};

const PRODUCT_ID_ALIASES: Record<string, string> = {
	bank_statement: "non_qm_bank_statement",
};
const QM_PRODUCT_IDS = new Set(["fannie_mae", "freddie_mac", "fha", "usda", "va"]);

function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

function toTitleCaseProductId(productId: string): string {
	return productId.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getLoanProductLabel(productId: string): string {
	const normalized = productId.trim().toLowerCase();
	const configured = LOAN_PRODUCT_CONFIG[normalized];
	if (configured) return configured.label;
	return toTitleCaseProductId(productId);
}

function formatMethod(method: string | null | undefined): string {
	if (!method) return "—";
	const normalized = method.toLowerCase();

	if (normalized.includes("24") && (normalized.includes("average") || normalized.includes("avg"))) {
		return "24-month average";
	}
	if (normalized.includes("12") && (normalized.includes("average") || normalized.includes("avg"))) {
		return "12-month average";
	}
	if (normalized.includes("lower")) {
		return "Lower of 2 years";
	}

	return method.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTrend(trend: string | null | undefined): string {
	if (!trend) return "—";
	const normalized = trend.toLowerCase();

	if (normalized === "increasing") return "Increasing";
	if (normalized === "stable") return "Stable";
	if (normalized === "declining") return "Declining";

	return trend.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getTrendKey(trend: string | null | undefined): CompareRow["trendKey"] {
	if (!trend) return "unknown";
	const normalized = trend.toLowerCase();
	if (normalized === "increasing") return "increasing";
	if (normalized === "stable") return "stable";
	if (normalized === "declining") return "declining";
	return "unknown";
}

function parseAmount(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const normalized = value.replace(/[$,\s]/g, "");
		if (!normalized) return null;
		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function normalizeProductId(productId: string): string {
	const normalized = productId.trim().toLowerCase();
	return PRODUCT_ID_ALIASES[normalized] ?? normalized;
}

function getLatestRefinementId(
	refinements:
		| Array<{
				refinement_id: string;
				refinement_num: number;
				created_at: string;
		  }>
		| null
		| undefined,
): string | null {
	if (!refinements?.length) return null;

	const sorted = [...refinements].sort((a, b) => {
		const aTime = Date.parse(a.created_at);
		const bTime = Date.parse(b.created_at);
		const aValid = Number.isFinite(aTime);
		const bValid = Number.isFinite(bTime);

		if (aValid && bValid && aTime !== bTime) {
			return bTime - aTime;
		}

		if (a.refinement_num !== b.refinement_num) {
			return b.refinement_num - a.refinement_num;
		}

		return b.refinement_id.localeCompare(a.refinement_id);
	});

	return sorted[0]?.refinement_id ?? null;
}

function getSourceHref(
	caseId: string,
	scenarioId: string,
	refinementId: string,
	productId: string,
): string {
	const normalizedProductId = normalizeProductId(productId);
	if (QM_PRODUCT_IDS.has(normalizedProductId)) {
		return `/case/${caseId}/scenario/${scenarioId}/refinement/${refinementId}/${normalizedProductId}`;
	}
	return `/case/${caseId}/scenario/${scenarioId}/refinement/${refinementId}/summary`;
}

export function ComparePage({ caseId }: ComparePageProps) {
	const { data: scenariosResponse, isLoading: scenariosLoading } = useCaseScenarios(caseId);
	const scenarios = scenariosResponse?.scenarios ?? [];

	const computedScenarios = useMemo(
		() => scenarios.filter((scenario) => scenario.status === "completed"),
		[scenarios],
	);

	const refinementQueries = useQueries({
		queries: computedScenarios.map((scenario) => ({
			queryKey: caseKeys.scenarioRefinements(caseId, scenario.scenario_id),
			queryFn: () => listRefinements(caseId, scenario.scenario_id),
			enabled: !!caseId,
			staleTime: 10_000,
			refetchOnWindowFocus: true as const,
		})),
	});

	const latestRefinementTargets = useMemo(
		() =>
			computedScenarios
				.map((scenario, index) => ({
					scenarioId: scenario.scenario_id,
					scenarioName: scenario.name,
					refinementId: getLatestRefinementId(refinementQueries[index]?.data?.refinements),
				}))
				.filter(
					(
						target,
					): target is {
						scenarioId: string;
						scenarioName: string;
						refinementId: string;
					} => !!target.refinementId,
				),
		[computedScenarios, refinementQueries],
	);

	const incomeQueries = useQueries({
		queries: latestRefinementTargets.map((target) => ({
			queryKey: caseKeys.income(caseId, target.refinementId),
			queryFn: () => getIncomeVerification(caseId, target.refinementId),
			enabled: !!caseId,
			staleTime: 15_000,
			refetchOnWindowFocus: true as const,
		})),
	});

	const rows = useMemo<CompareRow[]>(() => {
		const bestByProduct = new Map<
			string,
			{
				qualifyingIncome: number | null;
				method: string | null;
				trend: string | null;
				sourceScenarioName: string;
				sourceScenarioId: string;
				sourceRefinementId: string;
			}
		>();

		incomeQueries.forEach((query, index) => {
			if (!query.data) return;
			const target = latestRefinementTargets[index];
			if (!target) return;
			const verificationByProduct = query.data.income_verifications ?? {};
			Object.entries(verificationByProduct).forEach(([productId, verification]) => {
				const normalizedProductId = normalizeProductId(productId);
				const qualifyingIncome = parseAmount(verification?.combined_qualifying);
				const currentBest = bestByProduct.get(normalizedProductId);

				if (qualifyingIncome === null) {
					if (!currentBest) {
						bestByProduct.set(normalizedProductId, {
							qualifyingIncome: null,
							method: (typeof verification?.method === "string" && verification.method) || null,
							trend: verification?.trend ?? null,
							sourceScenarioName: target.scenarioName,
							sourceScenarioId: target.scenarioId,
							sourceRefinementId: target.refinementId,
						});
					}
					return;
				}

				if (
					!currentBest ||
					currentBest.qualifyingIncome === null ||
					qualifyingIncome > currentBest.qualifyingIncome
				) {
					bestByProduct.set(normalizedProductId, {
						qualifyingIncome,
						method: (typeof verification?.method === "string" && verification.method) || null,
						trend: verification?.trend ?? null,
						sourceScenarioName: target.scenarioName,
						sourceScenarioId: target.scenarioId,
						sourceRefinementId: target.refinementId,
					});
				}
			});
		});

		return Array.from(bestByProduct.entries())
			.map(([productId, value]) => ({
				key: productId,
				loanProduct: getLoanProductLabel(productId),
				qualifyingIncome: value.qualifyingIncome,
				calcPeriod: value.method ? formatMethod(value.method) : "—",
				trend: formatTrend(value.trend),
				trendKey: getTrendKey(value.trend),
				sourceScenarioName: value.sourceScenarioName,
				sourceHref: getSourceHref(
					caseId,
					value.sourceScenarioId,
					value.sourceRefinementId,
					productId,
				),
			}))
			.sort((a, b) => {
				if (a.qualifyingIncome === null && b.qualifyingIncome === null) {
					return a.loanProduct.localeCompare(b.loanProduct);
				}
				if (a.qualifyingIncome === null) return 1;
				if (b.qualifyingIncome === null) return -1;
				if (b.qualifyingIncome !== a.qualifyingIncome) {
					return b.qualifyingIncome - a.qualifyingIncome;
				}
				return a.loanProduct.localeCompare(b.loanProduct);
			});
	}, [caseId, incomeQueries, latestRefinementTargets]);

	const refinementLoading = refinementQueries.some((query) => query.isLoading);
	const incomeLoading = incomeQueries.some((query) => query.isLoading);
	const refinementError = refinementQueries.some((query) => query.isError);
	const incomeError = incomeQueries.some((query) => query.isError);
	const loading = scenariosLoading || refinementLoading || incomeLoading;

	if (loading) {
		return (
			<div className="p-6">
				<div className="bg-white rounded-xl border border-slate-200 p-6">
					<div className="animate-pulse space-y-4">
						<div className="h-5 w-64 bg-slate-200 rounded" />
						<div className="h-10 bg-slate-100 rounded" />
						<div className="h-10 bg-slate-100 rounded" />
						<div className="h-10 bg-slate-100 rounded" />
					</div>
				</div>
			</div>
		);
	}

	if (refinementError || incomeError) {
		return (
			<div className="p-6">
				<div className="bg-white rounded-xl border border-rose-200 p-6">
					<h2 className="text-lg font-semibold text-rose-900">Could not load comparison data</h2>
					<p className="text-sm text-rose-700 mt-1">
						One or more requests failed while loading refinements or income verification results.
						Try refreshing the page.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6 overflow-y-auto h-full">
			<div>
				<h1 className="text-2xl font-semibold text-slate-800">Qualifying Income by Loan Product</h1>
				<p className="text-sm text-slate-500 mt-1">
					Best qualifying income across computed scenarios using each scenario's latest refinement.
				</p>
			</div>

			<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm">
						<thead className="bg-slate-50 border-b border-slate-200">
							<tr>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Loan Product
								</th>
								<th className="text-right px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Qualifying Income
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Calc Period
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									Trend
								</th>
								<th className="text-left px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide">
									From
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{rows.map((row) => (
								<tr key={row.key} className="bg-white">
									<td className="px-4 py-3 text-slate-800 font-medium">{row.loanProduct}</td>
									<td className="px-4 py-3 text-right font-semibold text-slate-900">
										{row.qualifyingIncome === null
											? "—"
											: `${formatCurrency(row.qualifyingIncome)}/mo`}
									</td>
									<td className="px-4 py-3 text-slate-600">{row.calcPeriod}</td>
									<td className="px-4 py-3 text-slate-600">
										<span className="inline-flex items-center gap-1.5">
											{row.trendKey === "increasing" && (
												<ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
											)}
											{row.trendKey === "declining" && (
												<ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />
											)}
											{row.trendKey === "stable" && (
												<Minus className="w-3.5 h-3.5 text-amber-600" />
											)}
											<span>{row.trend}</span>
										</span>
									</td>
									<td className="px-4 py-3 text-slate-600">
										{row.sourceHref ? (
											<Link
												to={row.sourceHref}
												className="text-sky-700 hover:text-sky-800 hover:underline"
											>
												{row.sourceScenarioName}
											</Link>
										) : (
											<span>{row.sourceScenarioName}</span>
										)}
									</td>
								</tr>
							))}
							{rows.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-8 text-center text-slate-500">
										No refinement income results yet. Run income verification on scenarios to
										compare best product outcomes.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

export default ComparePage;
