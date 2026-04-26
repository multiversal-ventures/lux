import type { DocumentResponse } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery";

export function useDocuments(caseId: string) {
	return useOperatorQuery<DocumentResponse[]>(
		["documents", caseId],
		(client) => client.listDocuments(caseId),
		{ enabled: !!caseId },
	);
}
