import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
	getDefaultClient,
	type StructuredExtractionsResponse,
	type CreditReportRegions,
} from "@multiversal-ventures/lux-core";

export function useDocTypeRegions(
	caseId: string | null,
	docType: string,
	options?: { enabled?: boolean },
): UseQueryResult<StructuredExtractionsResponse, Error> {
	return useQuery<StructuredExtractionsResponse, Error>({
		queryKey: ["lux", "structured-extractions", caseId, docType],
		queryFn: () => getDefaultClient().getStructuredExtractions(caseId!, docType),
		enabled: (options?.enabled ?? true) && !!caseId,
		staleTime: 30_000,
	});
}

export function useCreditReport(
	caseId: string | null,
	options?: { enabled?: boolean },
): UseQueryResult<
	{ documents: Array<{ doc_id: string; file_id: string | null; regions: CreditReportRegions }> },
	Error
> {
	return useDocTypeRegions(caseId, "CreditReport", options) as UseQueryResult<
		{ documents: Array<{ doc_id: string; file_id: string | null; regions: CreditReportRegions }> },
		Error
	>;
}
