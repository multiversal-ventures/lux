import type { CreditReportSummary } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useCreditReport(caseId: string) {
	return useOperatorQuery<CreditReportSummary>(
		["creditReport", caseId],
		(client) => client.getCreditReportSummary(caseId),
		{ enabled: !!caseId },
	);
}
