import { useCallback, useState } from "react";
import type { CaseEvent, QualifyResult } from "@fenero/lux-core";
import { normalizeQualifyResult } from "@fenero/lux-core";
import { useOperatorClient } from "../providers/OperatorProvider.js";
import { useCaseEvents } from "../providers/CaseEventsProvider.js";

export type QualificationState = "idle" | "running" | "complete" | "error";

export interface UseQualificationReturn {
	state: QualificationState;
	result: QualifyResult | null;
	allResults: QualifyResult[];
	error: string | null;
	connecting: boolean;
	run: () => Promise<void>;
	reset: () => void;
}

export function useQualification(
	caseId: string,
	specId: string | null,
): UseQualificationReturn {
	const client = useOperatorClient();
	const [state, setState] = useState<QualificationState>("idle");
	const [result, setResult] = useState<QualifyResult | null>(null);
	const [allResults, setAllResults] = useState<QualifyResult[]>([]);
	const [error, setError] = useState<string | null>(null);

	// Subscribe imperatively: react to qualify.completed without re-rendering
	// on every intermediate event.
	const { connecting } = useCaseEvents({
		prefix: "qualify.",
		onEvent: useCallback((event: CaseEvent) => {
			if (event.event_type === "qualify.completed") {
				const { primary, all } = normalizeQualifyResult(event.event_data ?? {});
				setResult(primary);
				setAllResults(all);
				setState("complete");
			} else if (event.event_type === "qualify.failed") {
				setState("error");
				const msg = typeof event.event_data?.error === "string"
					? event.event_data.error
					: "Qualification failed";
				setError(msg);
			}
		}, []),
		deps: [],
	});

	const run = useCallback(async () => {
		if (!caseId) return;
		setState("running");
		setResult(null);
		setAllResults([]);
		setError(null);

		const res = await client.qualifyCase(caseId, specId ?? undefined);
		if (res.error) {
			setError(res.error.message);
			setState("error");
			return;
		}
		// Completion is driven by the SSE stream via the onEvent callback above.
	}, [client, caseId, specId]);

	const reset = useCallback(() => {
		setState("idle");
		setResult(null);
		setAllResults([]);
		setError(null);
	}, []);

	return { state, result, allResults, error, connecting, run, reset };
}
