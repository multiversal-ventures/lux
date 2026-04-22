import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
	areDraftIdSetsEqual,
	normalizeScenarioDraftPeriodFields,
	resolveScenarioPeriodVariant,
	type ScenarioDraft,
	type ScenarioPeriodVariant,
} from "../utils/scenarioDraft";

interface UseScenarioDraftOptions {
	initialDraft: ScenarioDraft;
	baselineDraft?: ScenarioDraft;
	resetKey?: string | number | null;
}

interface UseScenarioDraftResult {
	draft: ScenarioDraft;
	setDraft: Dispatch<SetStateAction<ScenarioDraft>>;
	periodVariant: ScenarioPeriodVariant;
	yearValidationError: string | null;
	hasChanges: boolean;
}

function areDraftsEqual(left: ScenarioDraft, right: ScenarioDraft): boolean {
	return (
		left.approach === right.approach &&
		areDraftIdSetsEqual(left.loanProductIds, right.loanProductIds) &&
		areDraftIdSetsEqual(left.borrowerIds, right.borrowerIds) &&
		areDraftIdSetsEqual(left.documentIds, right.documentIds) &&
		left.y1Override === right.y1Override &&
		left.y2Override === right.y2Override &&
		left.statementPeriodMonths === right.statementPeriodMonths &&
		left.note === right.note &&
		left.extractionEditCount === right.extractionEditCount
	);
}

export function useScenarioDraft({
	initialDraft,
	baselineDraft,
	resetKey,
}: UseScenarioDraftOptions): UseScenarioDraftResult {
	const [draft, setDraft] = useState<ScenarioDraft>(initialDraft);
	const resetKeyRef = useRef<string | number | null | undefined>(resetKey);
	const baseline = baselineDraft ?? initialDraft;

	useEffect(() => {
		if (Object.is(resetKeyRef.current, resetKey)) return;
		resetKeyRef.current = resetKey;
		setDraft(initialDraft);
	}, [baselineDraft, initialDraft, resetKey]);

	const periodVariant = useMemo(
		() => resolveScenarioPeriodVariant(draft.approach, draft.loanProductIds),
		[draft.approach, draft.loanProductIds],
	);

	const normalizedBaseline = useMemo(
		() =>
			normalizeScenarioDraftPeriodFields(
				baseline,
				resolveScenarioPeriodVariant(baseline.approach, baseline.loanProductIds),
			),
		[baseline],
	);

	useEffect(() => {
		setDraft((prev) => normalizeScenarioDraftPeriodFields(prev, periodVariant));
	}, [periodVariant]);

	const yearValidationError = useMemo(() => {
		if (periodVariant === "bank_statement") return null;
		if (!draft.y1Override || !draft.y2Override) return null;

		const y1 = Number(draft.y1Override);
		const y2 = Number(draft.y2Override);

		if (y1 === y2) return "Year 1 and Year 2 cannot be the same";
		if (y1 < y2) return "Year 1 must be more recent than Year 2";
		return null;
	}, [draft.y1Override, draft.y2Override, periodVariant]);

	const hasChanges = useMemo(
		() => !areDraftsEqual(draft, normalizedBaseline),
		[draft, normalizedBaseline],
	);

	return {
		draft,
		setDraft,
		periodVariant,
		yearValidationError,
		hasChanges,
	};
}
