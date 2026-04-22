import type { ScenarioDetail, MortgageApproach } from '../hooks/useApi';
import type { CaseResult, ExtractedDocument } from '../types';

export type ScenarioPeriodVariant = 'qm' | 'bank_statement' | '1099';

export interface ScenarioBorrower {
  id: string;
  name: string;
  role: string;
  type: string;
}

export interface ScenarioDraft {
  approach: MortgageApproach;
  loanProductIds: string[];
  borrowerIds: string[];
  documentIds: string[];
  y1Override: string | null;
  y2Override: string | null;
  statementPeriodMonths: number | null;
  note: string;
  extractionEditCount: number;
}

export const DEFAULT_SCENARIO_DRAFT: ScenarioDraft = {
  approach: 'qualified_mortgage',
  loanProductIds: [],
  borrowerIds: [],
  documentIds: [],
  y1Override: null,
  y2Override: null,
  statementPeriodMonths: null,
  note: '',
  extractionEditCount: 0,
};

function normalizeIds(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export function resolveScenarioPeriodVariant(
  approach: MortgageApproach,
  loanProductIds: string[] = [],
): ScenarioPeriodVariant {
  if (approach === 'non_qualified_mortgage') {
    const ids = loanProductIds.map((id) => id.toLowerCase());
    if (ids.some((id) => id.includes('1099'))) return '1099';
    if (ids.some((id) => id.includes('bank_statement'))) return 'bank_statement';
    return '1099';
  }
  return 'qm';
}

export function normalizeScenarioDraftPeriodFields(
  draft: ScenarioDraft,
  periodVariant: ScenarioPeriodVariant = resolveScenarioPeriodVariant(draft.approach, draft.loanProductIds),
): ScenarioDraft {
  if (periodVariant === 'bank_statement') {
    if (draft.y1Override === null && draft.y2Override === null) return draft;
    return {
      ...draft,
      y1Override: null,
      y2Override: null,
    };
  }

  if (draft.statementPeriodMonths === null) return draft;
  return {
    ...draft,
    statementPeriodMonths: null,
  };
}

export function buildBorrowers(caseResult: CaseResult | null | undefined): ScenarioBorrower[] {
  const entities = caseResult?.extractions?.financial_entities;
  if (!entities) return [];

  const result: ScenarioBorrower[] = [];

  for (const borrower of entities.borrowers ?? []) {
    result.push({
      id: borrower.ffi_id || borrower.display_name,
      name: borrower.display_name || borrower.canonical_name || 'Unknown Borrower',
      role: borrower.borrower_role || 'borrower',
      type: borrower.entity_type || 'person',
    });
  }

  for (const business of entities.businesses ?? []) {
    const entityType = business.entity_type || 'business';
    result.push({
      id: business.ffi_id || business.display_name,
      name: business.display_name || business.canonical_name || 'Unknown Business',
      role: entityType,
      type: entityType,
    });
  }

  return result;
}

export function getAvailableYears(documents: Array<Pick<ExtractedDocument, 'effective_period'>>): string[] {
  const years = new Set<string>();

  for (const doc of documents) {
    const periodEnd = doc.effective_period?.period_end;
    if (!periodEnd) continue;

    const year = new Date(periodEnd).getFullYear();
    years.add(String(year));
  }

  return Array.from(years).sort((a, b) => Number(b) - Number(a));
}

export function createDraftFromScenario(scenario: ScenarioDetail): ScenarioDraft {
  return {
    approach: scenario.approach,
    loanProductIds: [...(scenario.loan_product_ids ?? [])],
    borrowerIds: [...(scenario.borrower_ids ?? [])],
    documentIds: [...(scenario.document_ids ?? [])],
    y1Override: scenario.y1_override ?? null,
    y2Override: scenario.y2_override ?? null,
    statementPeriodMonths: scenario.statement_period_months ?? null,
    note: scenario.note ?? '',
    extractionEditCount: 0,
  };
}

export function areDraftIdSetsEqual(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizeIds(left);
  const normalizedRight = normalizeIds(right);

  if (normalizedLeft.length !== normalizedRight.length) return false;
  return normalizedLeft.every((value, index) => value === normalizedRight[index]);
}
