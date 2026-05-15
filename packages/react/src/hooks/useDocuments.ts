import type { DocumentResponse } from "@fenero-ai/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useDocuments(caseId: string) {
	return useOperatorQuery<DocumentResponse[]>(
		["documents", caseId],
		(client) => client.listDocuments(caseId),
		{ enabled: !!caseId },
	);
}
