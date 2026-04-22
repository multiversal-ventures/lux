import { useState } from "react";
import type { CalculationStep, CalculationInput } from "../../hooks/useApi";

/**
 * Format a calculation result based on its result_type.
 * - currency: $X,XXX.XX
 * - percentage: X.XX%
 * - boolean: "Yes ✓" / "No"
 * - number: X.XXXX (raw number)
 */
const BOOLEAN_NAME_RE =
	/^(is_|has_|both_|meets_|use_|needs_|should_|can_|allow|enable|require|flag)/i;

function looksLikeBoolean(result: unknown, derivationName?: string): boolean {
	if (typeof result === "boolean") return true;
	if (
		derivationName &&
		BOOLEAN_NAME_RE.test(derivationName) &&
		(result === 0 || result === 1 || result === 0.0 || result === 1.0)
	)
		return true;
	return false;
}

function formatBool(result: unknown): string {
	const truthy =
		result === true ||
		result === 1 ||
		result === "1" ||
		(typeof result === "number" && result !== 0);
	return truthy ? "Yes ✓" : "No";
}

function formatResult(
	result: number | string | boolean | null,
	resultType?: "currency" | "percentage" | "boolean" | "number",
	resultFormatted?: string,
	derivationName?: string,
): string {
	if (resultFormatted) return resultFormatted;
	if (result === null || result === undefined) return "—";

	if (resultType === "boolean" || looksLikeBoolean(result, derivationName)) {
		return formatBool(result);
	}

	switch (resultType) {
		case "percentage":
			if (typeof result === "number") {
				return `${(result * 100).toFixed(2)}%`;
			}
			return String(result);

		case "currency":
			if (typeof result === "number") {
				return `$${result.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
			}
			return String(result);

		case "number":
		default:
			if (typeof result === "number") {
				return Number.isInteger(result) ? String(result) : result.toFixed(4);
			}
			return String(result);
	}
}

interface CalculationLogProps {
	caseId: string;
	steps: CalculationStep[];
	defaultExpanded?: boolean;
	label?: string;
}

/**
 * Collapsible calculation log panel showing step-by-step derivations.
 */
export function CalculationLog({
	caseId: _caseId,
	steps,
	defaultExpanded = false,
	label,
}: CalculationLogProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded);

	if (!steps || steps.length === 0) {
		return null;
	}

	const finalStep = steps.find((s) => s.is_final) ?? steps[steps.length - 1];
	const formattedValue = finalStep
		? formatResult(
				finalStep.result,
				finalStep.result_type,
				finalStep.result_formatted,
				finalStep.derivation_name,
			)
		: null;

	return (
		<div className="font-[Calibri,'Segoe_UI',sans-serif]">
			{/* Row header -- Excel group-expand style */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				className="w-full flex items-center text-left border border-[#d4d4d4] bg-white hover:bg-[#f5f5f5] transition-colors"
			>
				{/* Expand/collapse indicator in a narrow gutter */}
				<span className="w-7 shrink-0 flex items-center justify-center border-r border-[#d4d4d4] self-stretch text-[10px] text-[#555] select-none">
					{isExpanded ? "−" : "+"}
				</span>
				<span className="flex-1 flex items-center justify-between px-[6px] py-[3px] min-w-0">
					{label ? (
						<span className="text-sm text-[#1e1e1e] truncate">
							{label}
							{formattedValue && formattedValue !== "—" && (
								<span className="ml-2 font-mono tabular-nums text-[#1e1e1e]">
									— {formattedValue}
								</span>
							)}
						</span>
					) : (
						<span className="text-sm text-[#1e1e1e]">
							Calculation Log
							<span className="ml-1 text-[#888]">({steps.length} steps)</span>
						</span>
					)}
					<span className="text-[11px] text-[#888] shrink-0 ml-4">
						{isExpanded ? "Hide" : "Show"} derivation steps
					</span>
				</span>
			</button>

			{/* Expanded derivation grid */}
			{isExpanded && (
				<div className="border-x border-[#d4d4d4]">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="bg-[#d9e2f3] text-[#1e1e1e]">
								<th className="border border-[#d4d4d4] px-[6px] py-[2px] text-left w-8 font-semibold">
									#
								</th>
								<th className="border border-[#d4d4d4] px-[6px] py-[2px] text-left font-semibold">
									Derivation
								</th>
								<th className="border border-[#d4d4d4] px-[6px] py-[2px] text-left font-semibold">
									Inputs
								</th>
								<th className="border border-[#d4d4d4] px-[6px] py-[2px] text-left font-semibold">
									Formula
								</th>
								<th className="border border-[#d4d4d4] px-[6px] py-[2px] text-right font-semibold w-36">
									Result
								</th>
							</tr>
						</thead>
						<tbody>
							{steps.map((step) => {
								const isFinal = step.is_final;
								const nonEmptyInputs = (step.input_values || []).filter(
									(i) => !isEmptyValue(i.value),
								);
								const hasFormula =
									!isEmptyValue(step.formula) || !isEmptyValue(step.formula_display);
								return (
									<tr
										key={step.step_number}
										className={isFinal ? "bg-[#e2efda]" : "bg-white hover:bg-[#f5f5f5]"}
									>
										{/* Step number */}
										<td className="border border-[#d4d4d4] px-[6px] py-[2px] text-center text-[#555] tabular-nums">
											{step.step_number}
										</td>
										{/* Name */}
										<td
											className={`border border-[#d4d4d4] px-[6px] py-[2px] ${isFinal ? "font-bold" : ""}`}
										>
											{step.display_label ||
												step.description ||
												(step.derivation_name ?? "").replace(/_/g, " ")}
										</td>
										{/* Inputs */}
										<td
											className="border border-[#d4d4d4] px-[6px] py-[2px] font-mono text-xs text-[#444] max-w-[260px] truncate"
											title={
												nonEmptyInputs.length > 0
													? nonEmptyInputs.map((input) => formatInputValue(input)).join("; ")
													: ""
											}
										>
											{nonEmptyInputs.length > 0
												? nonEmptyInputs.map((input) => formatInputValue(input)).join("; ")
												: ""}
										</td>
										{/* Formula */}
										<td
											className="border border-[#d4d4d4] px-[6px] py-[2px] font-mono text-xs text-[#444] max-w-[260px] truncate"
											title={step.formula_display || step.formula || ""}
										>
											{hasFormula ? step.formula_display || step.formula || "" : ""}
										</td>
										{/* Result */}
										<td
											className={`border border-[#d4d4d4] px-[6px] py-[2px] text-right font-mono tabular-nums ${
												isFinal ? "font-bold text-[#1e1e1e]" : "text-[#1e1e1e]"
											}`}
										>
											{!isEmptyValue(step.result)
												? formatResult(
														step.result,
														step.result_type,
														step.result_formatted,
														step.derivation_name,
													)
												: ""}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function isEmptyValue(value: unknown): boolean {
	return value === null || value === undefined || value === "";
}

function formatInputValue(input: CalculationInput): string {
	const formatted =
		typeof input.value === "number"
			? `$${input.value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
			: String(input.value);
	return `${input.name}: ${formatted}`;
}
