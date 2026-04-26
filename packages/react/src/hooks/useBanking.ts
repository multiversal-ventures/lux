import type { BankingResponse } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery";

export function useBanking(caseId: string) {
	return useOperatorQuery<BankingResponse>(
		["banking", caseId],
		(client) => client.getBanking(caseId),
		{ enabled: !!caseId },
	);
}
