import { useState, useCallback } from "react";
import { useOperatorClient } from "../../providers/OperatorProvider.js";
import type { VeritasScenarioAdviceItem } from "@multiversal-ventures/lux-core";

export interface UseScenarioAdviceReturn {
  items: VeritasScenarioAdviceItem[];
  narrative: string | null;
  isLoading: boolean;
  error: Error | null;
  fetch: () => void;
}

export function useScenarioAdvice(caseId: string, scenarioId: string): UseScenarioAdviceReturn {
  const client = useOperatorClient();
  const [items, setItems] = useState<VeritasScenarioAdviceItem[]>([]);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await client.getCaseScenarioAdvice(caseId, scenarioId);
      if (error) {
        setError(new Error(error.message));
      } else {
        setItems(data?.items ?? []);
        setNarrative(data?.narrative || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [client, caseId, scenarioId]);

  return { items, narrative, isLoading, error, fetch };
}
