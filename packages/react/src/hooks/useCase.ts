import type { CaseResponse } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery";

export function useCase(caseId: string) {
	return useOperatorQuery<CaseResponse>(
		["case", caseId],
		(client) => client.getCase(caseId),
		{ enabled: !!caseId },
	);
}
