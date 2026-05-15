import type { BankingResponse } from "@multiversal-ventures/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useBanking(caseId: string) {
	return useOperatorQuery<BankingResponse>(
		["banking", caseId],
		(client) => client.getBanking(caseId),
		{ enabled: !!caseId },
	);
}
