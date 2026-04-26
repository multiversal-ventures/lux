import type { CaseResponse } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery";

export function useCases(opts?: { specId?: string }) {
	return useOperatorQuery<CaseResponse[]>(
		["cases", opts?.specId ?? null],
		(client) => client.listCases(opts?.specId),
	);
}
