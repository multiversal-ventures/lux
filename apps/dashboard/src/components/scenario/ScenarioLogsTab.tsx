import type { CalculationStep, IncomeVerificationResult } from "../../hooks/useApi";
import { CalculationLog } from "../results/CalculationLog";

interface ScenarioLogsTabProps {
	caseId: string;
	productResult: IncomeVerificationResult | null;
}

interface SectionWithLogs {
	partyName: string;
	tableName: string;
	specFile: string;
	steps: CalculationStep[];
}

/**
 * ScenarioLogsTab - Calculation logs view for scenario income results.
 * Displays step-by-step derivation logs from each income section,
 * matching the CalculationLog display used in SpecResultCard / IncomeTab.
 */
export function ScenarioLogsTab({ caseId, productResult }: ScenarioLogsTabProps) {
	if (!productResult) {
		return (
			<div className="min-h-[200px] text-sm text-slate-500 italic">
				No income results available.
			</div>
		);
	}

	// Collect all sections with calculation_steps from all parties
	const sectionsWithLogs: SectionWithLogs[] = [];
	for (const party of productResult.parties ?? []) {
		for (const section of party.sections ?? []) {
			if (section.calculation_steps && section.calculation_steps.length > 0) {
				sectionsWithLogs.push({
					partyName: party.name,
					tableName: section.table_name,
					specFile: section.spec_file,
					steps: section.calculation_steps,
				});
			}
		}
	}

	// Group by party and sort by party name
	const byParty = new Map<string, SectionWithLogs[]>();
	for (const s of sectionsWithLogs) {
		const list = byParty.get(s.partyName) ?? [];
		list.push(s);
		byParty.set(s.partyName, list);
	}
	const sortedParties = Array.from(byParty.keys()).sort();

	if (sectionsWithLogs.length === 0) {
		return (
			<div className="min-h-[200px] text-sm text-slate-500 italic">
				No calculation logs available for this product.
			</div>
		);
	}

	return (
		<div className="font-[Calibri,'Segoe_UI',sans-serif] text-[#1e1e1e]">
			{sortedParties.map((partyName) => {
				const sections = byParty.get(partyName)!;
				return (
					<div key={partyName}>
						{/* Party name header row */}
						<div className="px-[6px] py-[3px] font-bold border border-[#d4d4d4] bg-[#e2efda] text-[#1e1e1e]">
							{partyName}
						</div>
						{/* Section rows */}
						{sections.map(({ tableName, specFile, steps }) => (
							<CalculationLog
								key={`${partyName}-${specFile}`}
								caseId={caseId}
								steps={steps}
								defaultExpanded={false}
								label={tableName}
							/>
						))}
					</div>
				);
			})}
		</div>
	);
}

export default ScenarioLogsTab;
