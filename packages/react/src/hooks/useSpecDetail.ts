import type { SpecResponse } from "@fenero/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useSpecDetail(specId: string) {
	return useOperatorQuery<SpecResponse & { yaml_content?: string | null }>(
		["spec", specId],
		(client) => client.getSpecDetail(specId),
		{ enabled: !!specId },
	);
}
