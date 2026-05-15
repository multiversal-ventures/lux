import type { CaseResponse } from "@fenero-ai/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useCases(opts?: { specId?: string }) {
	return useOperatorQuery<CaseResponse[]>(
		["cases", opts?.specId ?? null],
		(client) => client.listCases(opts?.specId),
	);
}
