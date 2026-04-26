import type { SpecAuditResponse } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useAudit(caseId: string) {
	return useOperatorQuery<SpecAuditResponse[]>(
		["audit", caseId],
		(client) => client.getAudit(caseId),
		{ enabled: !!caseId },
	);
}
