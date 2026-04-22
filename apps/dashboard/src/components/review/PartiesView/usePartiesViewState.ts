import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkIncomeReadiness, mergeParties, updateParty } from "../../../hooks/useApi";
import type { IncomeReadinessResponse } from "../../../hooks/useApi";
import { api } from "../../../lib/api";
import type { CaseResult, ExtractedDocument, Party } from "../../../types";
import type { BorrowerRole, PartyType } from "./partiesViewTypes";
import {
	extractIdentifierValue,
	extractLast4Digits,
	formatPartyName,
	isBusinessIdentifierField,
	isOrganizationName,
	isPersonIdentifierField,
} from "./partiesViewUtils";

export interface UsePartiesViewStateParams {
	result: CaseResult | null;
	caseId: string;
	onSelectionSaved?: () => void;
	onRefresh?: () => void;
}

export type PartyWithId = Party & { _id: string };

function getPartyDocuments(party: Party, documents: ExtractedDocument[]): ExtractedDocument[] {
	const matchingDocs: ExtractedDocument[] = [];
	const addedDocKeys = new Set<string>();
	const docKey = (doc: ExtractedDocument) =>
		`${doc.file_id}:${doc.document_type}:${doc.pages[0]?.page_number ?? 0}`;

	if (party.source_refs && party.source_refs.length > 0) {
		for (const ref of party.source_refs) {
			for (const doc of documents) {
				const key = docKey(doc);
				if (addedDocKeys.has(key)) continue;
				if (ref.document_type && doc.document_type === ref.document_type) {
					if (ref.page_number) {
						const hasPage = doc.pages.some((p) => p.page_number === ref.page_number);
						if (hasPage) {
							matchingDocs.push(doc);
							addedDocKeys.add(key);
						}
					} else {
						matchingDocs.push(doc);
						addedDocKeys.add(key);
					}
				} else if (ref.file_id && doc.file_id === ref.file_id && ref.page_number) {
					const hasPage = doc.pages.some((p) => p.page_number === ref.page_number);
					if (hasPage) {
						matchingDocs.push(doc);
						addedDocKeys.add(key);
					}
				}
			}
		}
	}

	if (matchingDocs.length === 0) {
		const partyIdentifiers = party.identifiers ?? {};
		const identifierPatterns: Array<{ last4: string; isBusinessId: boolean }> = [];
		for (const [key, value] of Object.entries(partyIdentifiers)) {
			const last4 = extractLast4Digits(value);
			if (last4) {
				const keyLower = key.toLowerCase();
				identifierPatterns.push({
					last4,
					isBusinessId: keyLower.includes("ein") || keyLower === "employer_id",
				});
			}
		}
		if (identifierPatterns.length > 0) {
			for (const doc of documents) {
				const key = docKey(doc);
				if (addedDocKeys.has(key)) continue;
				const hasMatch = doc.facts.some((fact) => {
					const fieldName = fact.field_name;
					const value = String(fact.value ?? "");
					const valueLast4 = extractLast4Digits(value);
					if (!valueLast4) return false;
					for (const pattern of identifierPatterns) {
						if (pattern.isBusinessId) {
							if (isBusinessIdentifierField(fieldName) && valueLast4 === pattern.last4) return true;
						} else {
							if (isPersonIdentifierField(fieldName) && valueLast4 === pattern.last4) return true;
						}
					}
					return false;
				});
				if (hasMatch) {
					matchingDocs.push(doc);
					addedDocKeys.add(key);
				}
			}
		}
	}
	return matchingDocs;
}

export function usePartiesViewState({
	result,
	caseId,
	onSelectionSaved,
	onRefresh,
}: UsePartiesViewStateParams) {
	const navigate = useNavigate();

	const [expandedParties, setExpandedParties] = useState<Set<string>>(new Set());
	const [borrowerSelections, setBorrowerSelections] = useState<Map<string, BorrowerRole>>(
		new Map(),
	);
	const [saving, setSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [selectionSaved, setSelectionSaved] = useState(false);
	const [partyTypeOverrides, setPartyTypeOverrides] = useState<Map<string, PartyType>>(new Map());
	const [showAllBusinesses, setShowAllBusinesses] = useState(false);
	const [showMergeModal, setShowMergeModal] = useState(false);
	const [mergeSourceId, setMergeSourceId] = useState<string | null>(null);
	const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
	const [mergeNewName, setMergeNewName] = useState("");
	const [merging, setMerging] = useState(false);
	const [mergeError, setMergeError] = useState<string | null>(null);
	const [mergeSuccess, setMergeSuccess] = useState<string | null>(null);
	const [recentlyMergedTargetId, setRecentlyMergedTargetId] = useState<string | null>(null);
	const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editingSaving, setEditingSaving] = useState(false);
	const [editError, setEditError] = useState<string | null>(null);
	const [dismissedAmbiguities, setDismissedAmbiguities] = useState<Set<string>>(new Set());
	const [readiness, setReadiness] = useState<IncomeReadinessResponse | null>(null);

	useEffect(() => {
		let cancelled = false;
		checkIncomeReadiness(caseId)
			.then((res) => {
				if (!cancelled) setReadiness(res);
			})
			.catch(() => {
				if (!cancelled) setReadiness(null);
			});
		return () => {
			cancelled = true;
		};
	}, [caseId]);

	const parties = useMemo(() => {
		const extractionsParties = result?.extractions?.parties;
		const rawParties = Array.isArray(extractionsParties)
			? extractionsParties
			: (extractionsParties?.parties ?? result?.parties ?? []);
		return rawParties.map((p, i) => {
			if (typeof p === "string") {
				return { name: p, role: "unknown" as const, _id: `party-${i}` };
			}
			const existingId = p.id || p._id;
			return { ...p, _id: existingId || `party-${i}` };
		}) as PartyWithId[];
	}, [result]);

	const documents = useMemo(() => result?.extractions?.documents ?? [], [result]);
	const financialEntities = result?.extractions?.financial_entities;

	const inferPartyType = useCallback((party: PartyWithId): PartyType => {
		if (party.party_type) {
			const pt = party.party_type as string;
			return pt === "individual" || pt === "person" ? "individual" : "business";
		}
		const partyName = typeof party.name === "string" ? party.name : String(party.name ?? "");
		const hasEin = party.identifiers
			? Object.keys(party.identifiers).some((k) => k.toLowerCase().includes("ein"))
			: false;
		const hasSsn = party.identifiers
			? Object.keys(party.identifiers).some((k) => k.toLowerCase().includes("ssn"))
			: false;
		const looksLikeOrg = isOrganizationName(partyName);
		if (hasEin || (looksLikeOrg && !hasSsn)) return "business";
		return "individual";
	}, []);

	const getPartyType = useCallback(
		(party: PartyWithId): PartyType => {
			return partyTypeOverrides.get(party._id) ?? inferPartyType(party);
		},
		[partyTypeOverrides, inferPartyType],
	);

	useEffect(() => {
		const initial = new Map<string, BorrowerRole>();
		if (financialEntities?.borrower_selection_complete) {
			for (const borrower of financialEntities.borrowers ?? []) {
				const matchingParty = parties.find((p) => {
					const pName = String(p.name).toUpperCase();
					const pNameOriginal = String(p.name);
					if (pName === borrower.canonical_name) return true;
					if (pName === borrower.display_name?.toUpperCase()) return true;
					const aliases = borrower.name_aliases ?? [];
					if (aliases.some((a: string) => a.toUpperCase() === pName || a === pNameOriginal))
						return true;
					const partyAliases = p.name_aliases ?? [];
					if (partyAliases.some((a: string) => a.toUpperCase() === borrower.canonical_name))
						return true;
					return false;
				});
				if (matchingParty) {
					const role =
						borrower.borrower_role === "primary"
							? "primary"
							: borrower.borrower_role === "co_borrower"
								? "co_borrower"
								: "ignore";
					initial.set(matchingParty._id, role);
				}
			}
			for (const ignoredName of financialEntities.ignored_party_names ?? []) {
				const matchingParty = parties.find((p) => {
					const pName = String(p.name).toUpperCase();
					if (pName === ignoredName) return true;
					const partyAliases = p.name_aliases ?? [];
					return partyAliases.some((a: string) => a.toUpperCase() === ignoredName);
				});
				if (matchingParty) initial.set(matchingParty._id, "ignore");
			}
			setSelectionSaved(true);
		} else {
			let individualIndex = 0;
			parties.forEach((party) => {
				const hasEin = party.identifiers
					? Object.keys(party.identifiers).some((k) => k.toLowerCase().includes("ein"))
					: false;
				const partyType = party.party_type ?? "";
				const isBusiness = partyType === "business" || partyType === "employer" || hasEin;
				if (!isBusiness) {
					const roles = (party.role ?? "").toLowerCase();
					const isLikelyBorrower =
						["taxpayer", "employee", "borrower", "proprietor", "spouse"].some((r) =>
							roles.includes(r),
						) && !(roles.includes("tax_preparer") && !roles.includes("taxpayer"));
					if (isLikelyBorrower) {
						initial.set(party._id, individualIndex === 0 ? "primary" : "co_borrower");
						individualIndex++;
					} else {
						initial.set(party._id, "ignore");
					}
				}
			});
		}
		setBorrowerSelections(initial);
	}, [parties, financialEntities]);

	const handleRoleChange = useCallback((partyId: string, newRole: BorrowerRole) => {
		setBorrowerSelections((prev) => {
			const updated = new Map(prev);
			if (newRole === "primary") {
				for (const [id, role] of updated) {
					if (role === "primary" && id !== partyId) updated.set(id, "co_borrower");
				}
			}
			updated.set(partyId, newRole);
			setSelectionSaved(false);
			return updated;
		});
	}, []);

	const handleSaveSelections = useCallback(async () => {
		setSaving(true);
		setSaveError(null);
		try {
			const partyIds = new Set([
				...Array.from(borrowerSelections.keys()),
				...Array.from(partyTypeOverrides.keys()),
			]);
			const selectionsArray = Array.from(partyIds).map((partyId) => {
				const role = borrowerSelections.get(partyId) ?? "ignore";
				const partyTypeOverride = partyTypeOverrides.get(partyId);
				let party_type: string | undefined;
				if (partyTypeOverride) {
					party_type = partyTypeOverride === "individual" ? "person" : "business";
				}
				return { party_id: partyId, role, ...(party_type && { party_type }) };
			});
			await api.post(`/api/v1/case/${caseId}/borrower-selection`, {
				selections: selectionsArray,
			});
			setSelectionSaved(true);
			onSelectionSaved?.();
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Failed to save selection");
		} finally {
			setSaving(false);
		}
	}, [borrowerSelections, partyTypeOverrides, caseId, onSelectionSaved]);

	const openMergeModal = useCallback((sourcePartyId: string) => {
		setMergeSourceId(sourcePartyId);
		setMergeTargetId(null);
		setMergeNewName("");
		setMergeError(null);
		setShowMergeModal(true);
	}, []);

	const handleMerge = useCallback(async () => {
		if (!mergeSourceId || !mergeTargetId) return;
		setMerging(true);
		setMergeError(null);
		setMergeSuccess(null);
		const sourceParty = parties.find((p) => p._id === mergeSourceId);
		const targetParty = parties.find((p) => p._id === mergeTargetId);
		const sourceName = formatPartyName(sourceParty?.name ?? "");
		const targetName = formatPartyName(targetParty?.name ?? "");
		try {
			await mergeParties(caseId, {
				source_party_id: mergeSourceId,
				target_party_id: mergeTargetId,
				new_name: mergeNewName || undefined,
			});
			setShowMergeModal(false);
			setSelectionSaved(false);
			setMergeSuccess(
				`Merged "${sourceName}" into "${targetName}". Save selections to update borrower data.`,
			);
			setRecentlyMergedTargetId(mergeTargetId);
			setTimeout(() => {
				setMergeSuccess(null);
				setRecentlyMergedTargetId(null);
			}, 8000);
			onRefresh?.();
		} catch (err) {
			setMergeError(err instanceof Error ? err.message : "Failed to merge parties");
		} finally {
			setMerging(false);
		}
	}, [caseId, mergeSourceId, mergeTargetId, mergeNewName, onRefresh, parties]);

	const openEditModal = useCallback((partyId: string, currentName: string) => {
		setEditingPartyId(partyId);
		setEditName(currentName);
		setEditError(null);
	}, []);

	const handleEditName = useCallback(async () => {
		if (!editingPartyId || !editName.trim()) return;
		setEditingSaving(true);
		setEditError(null);
		try {
			await updateParty(caseId, editingPartyId, { name: editName.trim() });
			setEditingPartyId(null);
			setSelectionSaved(false);
			onRefresh?.();
		} catch (err) {
			setEditError(err instanceof Error ? err.message : "Failed to update party name");
		} finally {
			setEditingSaving(false);
		}
	}, [caseId, editingPartyId, editName, onRefresh]);

	const togglePartyType = useCallback(
		(partyId: string) => {
			setPartyTypeOverrides((prev) => {
				const updated = new Map(prev);
				const party = parties.find((p) => p._id === partyId);
				if (!party) return prev;
				const currentType = updated.get(partyId) ?? inferPartyType(party);
				updated.set(partyId, currentType === "individual" ? "business" : "individual");
				setSelectionSaved(false);
				return updated;
			});
		},
		[parties, inferPartyType],
	);

	const { individuals, businesses } = useMemo(() => {
		const individuals: PartyWithId[] = [];
		const businesses: PartyWithId[] = [];
		for (const party of parties) {
			if (getPartyType(party) === "business") {
				businesses.push(party);
			} else {
				individuals.push(party);
			}
		}
		return { individuals, businesses };
	}, [parties, getPartyType]);

	const businessesByIndividual = useMemo(() => {
		const mapping = new Map<string, PartyWithId[]>();
		for (const ind of individuals) mapping.set(ind._id, []);
		for (const biz of businesses) {
			const bizDocs = new Set<string>();
			if (biz.source_refs) {
				for (const ref of biz.source_refs) {
					if (ref.document_type) bizDocs.add(ref.document_type);
				}
			}
			let matched = false;
			for (const ind of individuals) {
				if (ind.source_refs?.some((ref) => ref.document_type && bizDocs.has(ref.document_type))) {
					mapping.get(ind._id)?.push(biz);
					matched = true;
				}
			}
			if (!matched && individuals.length > 0) {
				mapping.get(individuals[0]._id)?.push(biz);
			}
		}
		return mapping;
	}, [individuals, businesses]);

	const potentialAmbiguities = useMemo(() => {
		const ssnLast4Map = new Map<string, Array<{ party: PartyWithId; masked: boolean }>>();
		for (const party of individuals) {
			const identifiers = party.identifiers ?? {};
			for (const [key, value] of Object.entries(identifiers)) {
				const keyLower = key.toLowerCase();
				if (keyLower.includes("ssn") || keyLower.includes("social")) {
					const strValue = extractIdentifierValue(value);
					if (strValue) {
						const digits = strValue.replace(/[^\d]/g, "");
						if (digits.length >= 4) {
							const last4 = digits.slice(-4);
							const masked = digits.length < 9;
							if (!ssnLast4Map.has(last4)) ssnLast4Map.set(last4, []);
							ssnLast4Map.get(last4)!.push({ party, masked });
						}
					}
				}
			}
		}
		const ambiguous: Array<{
			last4: string;
			parties: Array<{ party: PartyWithId }>;
		}> = [];
		for (const [last4, partiesWithSsn] of ssnLast4Map) {
			if (partiesWithSsn.length > 1) {
				ambiguous.push({
					last4,
					parties: partiesWithSsn.map(({ party }) => ({ party })),
				});
			}
		}
		return ambiguous;
	}, [individuals]);

	const partiesNeedingReview = useMemo(() => {
		const ids = new Set<string>();
		for (const { last4, parties: ambiguousParties } of potentialAmbiguities) {
			if (dismissedAmbiguities.has(last4)) continue;
			for (const { party } of ambiguousParties) ids.add(party._id);
		}
		return ids;
	}, [potentialAmbiguities, dismissedAmbiguities]);

	const getPartyDocumentsMemo = useCallback(
		(party: Party) => getPartyDocuments(party, documents),
		[documents],
	);

	const toggleExpanded = useCallback((partyId: string) => {
		setExpandedParties((prev) => {
			const next = new Set(prev);
			if (next.has(partyId)) next.delete(partyId);
			else next.add(partyId);
			return next;
		});
	}, []);

	const navigateToDocument = useCallback(
		(doc: ExtractedDocument) => {
			const firstPage = doc.pages[0]?.page_number ?? 1;
			navigate(`/case/${caseId}/view?file=${doc.file_id}&page=${firstPage}`);
		},
		[caseId, navigate],
	);

	const navigateToSource = useCallback(
		(fileId: string, page: number) => {
			navigate(`/case/${caseId}/view?file=${fileId}&page=${page}`);
		},
		[caseId, navigate],
	);

	const setMergeTargetIdState = useCallback((id: string | null) => setMergeTargetId(id), []);
	const setMergeNewNameState = useCallback((name: string) => setMergeNewName(name), []);
	const setEditNameState = useCallback((name: string) => setEditName(name), []);
	const dismissAmbiguity = useCallback((last4: string) => {
		setDismissedAmbiguities((prev) => new Set([...prev, last4]));
	}, []);
	const openMergeModalForAmbiguity = useCallback((sourceId: string, targetId: string) => {
		setMergeSourceId(sourceId);
		setMergeTargetId(targetId);
		setMergeNewName("");
		setMergeError(null);
		setShowMergeModal(true);
	}, []);

	return {
		parties,
		documents,
		individuals,
		businesses,
		businessesByIndividual,
		potentialAmbiguities,
		partiesNeedingReview,
		readiness,
		expandedParties,
		borrowerSelections,
		saving,
		saveError,
		selectionSaved,
		showAllBusinesses,
		setShowAllBusinesses,
		showMergeModal,
		mergeSourceId,
		mergeTargetId,
		mergeNewName,
		merging,
		mergeError,
		mergeSuccess,
		recentlyMergedTargetId,
		editingPartyId,
		editName,
		editingSaving,
		editError,
		dismissedAmbiguities,
		getPartyType,
		getPartyDocuments: getPartyDocumentsMemo,
		handleRoleChange,
		handleSaveSelections,
		openMergeModal,
		handleMerge,
		openEditModal,
		handleEditName,
		togglePartyType,
		toggleExpanded,
		navigateToDocument,
		setMergeTargetId: setMergeTargetIdState,
		setMergeNewName: setMergeNewNameState,
		setEditName: setEditNameState,
		setShowMergeModal,
		setEditingPartyId,
		dismissAmbiguity,
		openMergeModalForAmbiguity,
		navigateToSource,
	};
}
