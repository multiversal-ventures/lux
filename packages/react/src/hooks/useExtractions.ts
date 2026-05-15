import type { ExtractionResponse } from "@fenero-ai/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useExtractions(
	caseId: string,
	opts?: { docId?: string },
) {
	return useOperatorQuery<ExtractionResponse[]>(
		["extractions", caseId, opts?.docId ?? null],
		(client) => client.listExtractions(caseId, opts),
		{ enabled: !!caseId },
	);
}
