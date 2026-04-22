import * as gunnr from "./gunnr-api.js";

/**
 * Typed user actions mapped to Gunnr HTTP calls.
 * Batch: {@link dispatchLuxIntents} runs serially until a Veritas batch endpoint exists.
 */
export type LuxIntent =
	| { type: "upload"; files: FileList | File[]; onProgress?: (progress: number) => void }
	| { type: "upload_direct"; files: FileList | File[]; options?: gunnr.DirectUploadOptions }
	| {
			type: "reclassify_page";
			caseId: string;
			fileId: string;
			pageNumber: number;
			newDocumentClass: string;
	  }
	| { type: "patch_case"; caseId: string; request: gunnr.PatchCaseRequest }
	| { type: "start_extraction"; caseId: string; request: gunnr.StartCaseRequest }
	| { type: "reextract"; caseId: string; request: gunnr.ReextractRequest }
	| { type: "start_income"; caseId: string; loanProductId: string; rulesVersion?: string }
	| { type: "start_credit"; caseId: string; request: gunnr.StartCreditVerificationRequest }
	| { type: "start_scenario"; caseId: string; scenarioId: string }
	| { type: "start_refinement"; caseId: string; scenarioId: string; refinementId: string }
	| { type: "merge_parties"; caseId: string; request: gunnr.MergePartiesRequest }
	| {
			type: "reclassify_transactions";
			caseId: string;
			updates: { transaction_id: string; classification: string }[];
	  }
	| { type: "submit_review_decisions"; caseId: string; decisions: gunnr.ReviewDecision[] }
	| { type: "confirm_tax_year"; caseId: string; request: gunnr.ConfirmTaxYearRequest }
	| { type: "cancel_case"; caseId: string }
	| { type: "delete_case"; caseId: string };

export async function dispatchLuxIntent(intent: LuxIntent): Promise<unknown> {
	switch (intent.type) {
		case "upload":
			return gunnr.uploadFiles(intent.files, intent.onProgress);
		case "upload_direct":
			return gunnr.uploadFilesDirectToGCS(intent.files, intent.options);
		case "reclassify_page":
			return gunnr.reclassifyPage(
				intent.caseId,
				intent.fileId,
				intent.pageNumber,
				intent.newDocumentClass,
			);
		case "patch_case":
			return gunnr.patchCase(intent.caseId, intent.request);
		case "start_extraction":
			return gunnr.startCase(intent.caseId, intent.request);
		case "reextract":
			return gunnr.reextractPages(intent.caseId, intent.request);
		case "start_income":
			return gunnr.startIncomeVerification(
				intent.caseId,
				intent.loanProductId,
				intent.rulesVersion,
			);
		case "start_credit":
			return gunnr.startCreditVerificationWithOptions(intent.caseId, intent.request);
		case "start_scenario":
			return gunnr.startScenario(intent.caseId, intent.scenarioId);
		case "start_refinement":
			return gunnr.startRefinement(intent.caseId, intent.scenarioId, intent.refinementId);
		case "merge_parties":
			return gunnr.mergeParties(intent.caseId, intent.request);
		case "reclassify_transactions":
			return gunnr.reclassifyTransactions(intent.caseId, intent.updates);
		case "submit_review_decisions":
			return gunnr.submitReviewDecisions(intent.caseId, intent.decisions);
		case "confirm_tax_year":
			return gunnr.confirmTaxYear(intent.caseId, intent.request);
		case "cancel_case":
			return gunnr.cancelCase(intent.caseId);
		case "delete_case":
			return gunnr.deleteCase(intent.caseId);
	}
}

/** Serial batch — TODO: single Veritas batch endpoint when available. */
export async function dispatchLuxIntents(intents: LuxIntent[]): Promise<unknown[]> {
	const out: unknown[] = [];
	for (const i of intents) {
		out.push(await dispatchLuxIntent(i));
	}
	return out;
}
