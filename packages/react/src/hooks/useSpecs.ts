import type { SpecResponse } from "@multiversal-ventures/lux-core";
import { useOperatorQuery } from "./_useOperatorQuery.js";

export function useSpecs(opts?: { domain?: string }) {
	return useOperatorQuery<SpecResponse[]>(
		["specs", opts?.domain ?? null],
		(client) => client.listSpecs(opts?.domain),
	);
}
