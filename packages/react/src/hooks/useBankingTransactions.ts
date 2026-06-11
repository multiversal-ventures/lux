import type { ClassifiedTransactionsResponse } from "@multiversal-ventures/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useBankingTransactions(caseId: string) {
	return useOperatorQuery<ClassifiedTransactionsResponse>(
		["banking-transactions", caseId],
		(client) => client.getBankingTransactions(caseId),
		{ enabled: !!caseId },
	);
}
