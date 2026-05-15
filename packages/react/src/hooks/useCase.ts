import type { CaseResponse } from "@fenero-ai/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useCase(caseId: string) {
	return useOperatorQuery<CaseResponse>(
		["case", caseId],
		(client) => client.getCase(caseId),
		{ enabled: !!caseId },
	);
}
