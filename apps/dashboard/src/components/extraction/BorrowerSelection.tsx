import { useState, useMemo, useCallback } from "react";
import type { Party, CaseResult } from "../../types";
import { api } from "../../lib/api";

interface BorrowerSelectionProps {
	result: CaseResult | null;
	caseId: string;
	onSelectionSaved?: () => void;
	/** If true, selection has been completed */
	isComplete?: boolean;
}

interface BorrowerRole {
	partyId: string;
	role: "primary" | "co_borrower" | "ignore";
}

/**
 * BorrowerSelection - UI for selecting borrower roles before income verification.
 *
 * Shows all person parties (SSN-based) with a dropdown to select their role:
 * - Primary Borrower: Main borrower on the loan
 * - Co-Borrower: Additional borrower (spouse, partner)
 * - Ignore: Exclude from income calculation
 *
 * Businesses (EIN-based) are NOT shown here - they are auto-inferred from documents.
 */
export function BorrowerSelection({
	result,
	caseId,
	onSelectionSaved,
	isComplete: initialIsComplete = false,
}: BorrowerSelectionProps) {
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isComplete, setIsComplete] = useState(initialIsComplete);

	// Extended party type with internal ID
	type PartyWithId = Party & { _id: string };

	// Get parties from result
	const parties = useMemo((): PartyWithId[] => {
		// Handle multiple possible party locations in the result structure
		const extractionsParties = result?.extractions?.parties;
		const rawParties = Array.isArray(extractionsParties)
			? extractionsParties
			: (extractionsParties?.parties ?? result?.parties ?? []);
		return rawParties.map((p, i): PartyWithId => {
			if (typeof p === "string") {
				return {
					name: p,
					role: "borrower" as const,
					_id: `party-${i}`,
					identifiers: {},
				};
			}
			return { ...p, _id: `party-${i}` };
		});
	}, [result]);

	// Get only person parties (exclude businesses/employers)
	const personParties = useMemo((): PartyWithId[] => {
		return parties.filter((party) => {
			// Exclude if party has EIN identifier
			const hasEin = party.identifiers
				? Object.keys(party.identifiers).some((key) => key.toLowerCase().includes("ein"))
				: false;

			// Exclude if party_type is business/employer
			const partyType = party.party_type || "";
			const isBusinessType = partyType === "business" || partyType === "employer";

			return !hasEin && !isBusinessType;
		});
	}, [parties]);

	// Initialize selections from existing financial_entities or default
	const [selections, setSelections] = useState<Map<string, BorrowerRole["role"]>>(() => {
		const initial = new Map<string, BorrowerRole["role"]>();

		// Check if financial_entities already exists in result
		const financialEntities = result?.extractions?.financial_entities;
		if (financialEntities?.borrower_selection_complete) {
			// Populate from existing selections
			for (const borrower of financialEntities.borrowers ?? []) {
				// Find matching party by name or FFI ID
				const matchingParty = personParties.find((p) => {
					const pName = extractStringValue(p.name).toUpperCase();
					return (
						pName === borrower.canonical_name || pName === borrower.display_name?.toUpperCase()
					);
				});
				if (matchingParty) {
					initial.set(matchingParty._id, borrower.borrower_role as BorrowerRole["role"]);
				}
			}

			// Mark ignored parties (match by normalized name)
			for (const ignoredName of financialEntities.ignored_party_names ?? []) {
				const matchingParty = personParties.find(
					(p) => String(p.name).toUpperCase() === ignoredName,
				);
				if (matchingParty) {
					initial.set(matchingParty._id, "ignore");
				}
			}

			setIsComplete(true);
		} else {
			// Default: first person is primary, others are co_borrower
			personParties.forEach((party, index) => {
				initial.set(party._id, index === 0 ? "primary" : "co_borrower");
			});
		}

		return initial;
	});

	// Count documents per party (approximation via identifiers)
	const getDocCount = (party: Party): number => {
		const documents = result?.extractions?.documents ?? [];
		const identifiers = party.identifiers || {};
		let count = 0;

		// Simple heuristic: count docs that might match via source_refs
		if (party.source_refs && party.source_refs.length > 0) {
			count = party.source_refs.length;
		} else {
			// Count based on identifier presence in doc facts
			const partyIds = Object.values(identifiers)
				.map((v) => extractLast4(v))
				.filter(Boolean);
			for (const doc of documents) {
				for (const fact of doc.facts ?? []) {
					const factValue = extractLast4(String(fact.value ?? ""));
					if (factValue && partyIds.includes(factValue)) {
						count++;
						break;
					}
				}
			}
		}

		return count || 1;
	};

	const handleRoleChange = useCallback((partyId: string, role: BorrowerRole["role"]) => {
		setSelections((prev) => {
			const newSelections = new Map(prev);

			// If setting as primary, demote any existing primary to co_borrower
			if (role === "primary") {
				for (const [id, existingRole] of newSelections) {
					if (existingRole === "primary" && id !== partyId) {
						newSelections.set(id, "co_borrower");
					}
				}
			}

			newSelections.set(partyId, role);
			return newSelections;
		});
		setIsComplete(false); // Mark as needing to save
	}, []);

	const handleSave = async () => {
		setSaving(true);
		setError(null);

		try {
			// Convert selections to API format
			const selectionsArray = Array.from(selections).map(([partyId, role]) => ({
				party_id: partyId,
				role,
			}));

			await api.post(`/api/v1/case/${caseId}/borrower-selection`, { selections: selectionsArray });

			setIsComplete(true);
			onSelectionSaved?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save selection");
		} finally {
			setSaving(false);
		}
	};

	// Extract string value helper
	const extractStringValue = (field: unknown): string => {
		if (field === null || field === undefined) return "";
		if (typeof field === "string") return field;
		if (typeof field === "number") return String(field);
		if (typeof field === "object") {
			const obj = field as Record<string, unknown>;
			if ("value" in obj) return extractStringValue(obj.value);
			if ("name" in obj) return extractStringValue(obj.name);
		}
		return String(field);
	};

	// Extract last 4 digits
	const extractLast4 = (value: unknown): string | null => {
		const strValue = extractStringValue(value);
		if (!strValue) return null;
		const digits = strValue.replace(/[^\d]/g, "");
		return digits.length >= 4 ? digits.slice(-4) : null;
	};

	// Format identifier for display
	const formatIdentifier = (key: string, value: unknown): string => {
		const strValue = extractStringValue(value);
		if (!strValue) return "N/A";

		const keyLower = key.toLowerCase();
		if (keyLower.includes("ssn")) {
			if (strValue.includes("X") || strValue.includes("*")) return strValue;
			const digits = strValue.replace(/[^\d]/g, "");
			if (digits.length === 9) {
				return `XXX-XX-${digits.slice(-4)}`;
			}
			return strValue;
		}
		return strValue;
	};

	if (personParties.length === 0) {
		return (
			<div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
				<div className="flex items-center gap-2 mb-4">
					<svg
						className="w-5 h-5 text-amber-500"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
						Borrower Selection
					</h2>
					<span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
						No persons found
					</span>
				</div>
				<p className="text-sm text-slate-500">
					No person parties were identified in the documents.
				</p>
			</div>
		);
	}

	const hasPrimary = Array.from(selections.values()).includes("primary");
	const selectedCount = Array.from(selections.values()).filter((r) => r !== "ignore").length;

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
			{/* Header */}
			<div className="flex items-center gap-2 mb-4">
				<svg
					className="w-5 h-5 text-slate-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
					/>
				</svg>
				<h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
					Borrower Selection
				</h2>
				{!isComplete && !hasPrimary && (
					<span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded flex items-center gap-1">
						<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 9v2m0 4h.01"
							/>
						</svg>
						Required
					</span>
				)}
				{isComplete && (
					<span className="ml-auto text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1">
						<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M5 13l4 4L19 7"
							/>
						</svg>
						Saved
					</span>
				)}
			</div>

			{/* Party list */}
			<div className="space-y-3">
				{personParties.map((party) => {
					const partyId = party._id;
					const docCount = getDocCount(party);
					const currentRole = selections.get(partyId) || "ignore";

					return (
						<div
							key={partyId}
							className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
								currentRole === "ignore"
									? "bg-slate-50 border-slate-200 opacity-60"
									: currentRole === "primary"
										? "bg-blue-50 border-blue-200"
										: "bg-white border-slate-200"
							}`}
						>
							<div className="flex items-center gap-3">
								<div
									className={`w-10 h-10 rounded-full flex items-center justify-center ${
										currentRole === "primary"
											? "bg-blue-100"
											: currentRole === "co_borrower"
												? "bg-indigo-100"
												: "bg-slate-200"
									}`}
								>
									<span
										className={`text-sm font-semibold ${
											currentRole === "primary"
												? "text-blue-600"
												: currentRole === "co_borrower"
													? "text-indigo-600"
													: "text-slate-400"
										}`}
									>
										{extractStringValue(party.name)
											.split(" ")
											.map((n) => n[0])
											.join("")
											.slice(0, 2)
											.toUpperCase()}
									</span>
								</div>
								<div>
									<div className="font-medium text-slate-800">{extractStringValue(party.name)}</div>
									<div className="flex items-center gap-3 text-xs text-slate-500">
										{party.identifiers &&
											Object.entries(party.identifiers)
												.slice(0, 2)
												.map(([key, value]) => (
													<span key={key} className="flex items-center gap-1">
														<span className="uppercase font-medium">{key}:</span>
														<span className="font-mono">{formatIdentifier(key, value)}</span>
													</span>
												))}
										<span className="text-slate-400">
											• {docCount} document{docCount !== 1 ? "s" : ""}
										</span>
									</div>
								</div>
							</div>

							{/* Role dropdown */}
							<select
								value={currentRole}
								onChange={(e) => handleRoleChange(partyId, e.target.value as BorrowerRole["role"])}
								className={`px-3 py-1.5 text-sm font-medium rounded-lg border appearance-none cursor-pointer transition-colors ${
									currentRole === "primary"
										? "bg-blue-100 border-blue-300 text-blue-700"
										: currentRole === "co_borrower"
											? "bg-indigo-100 border-indigo-300 text-indigo-700"
											: "bg-slate-100 border-slate-300 text-slate-500"
								}`}
							>
								<option value="primary">Primary</option>
								<option value="co_borrower">Co-Borrower</option>
								<option value="ignore">Ignore</option>
							</select>
						</div>
					);
				})}
			</div>

			{/* Error message */}
			{error && (
				<div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
					{error}
				</div>
			)}

			{/* Save button */}
			<div className="mt-4 flex items-center justify-between">
				<div className="text-sm text-slate-500">
					{selectedCount} borrower{selectedCount !== 1 ? "s" : ""} selected
				</div>
				<button
					onClick={handleSave}
					disabled={saving || !hasPrimary}
					className={`px-4 py-2 rounded-lg font-medium transition-colors ${
						saving
							? "bg-slate-200 text-slate-400 cursor-not-allowed"
							: !hasPrimary
								? "bg-amber-100 text-amber-600 border-2 border-amber-300 cursor-not-allowed"
								: isComplete
									? "bg-green-100 text-green-700 border-2 border-green-300 hover:bg-green-200"
									: "bg-amber-100 text-amber-700 border-2 border-amber-400 hover:bg-amber-200"
					}`}
				>
					{saving ? (
						<span className="flex items-center gap-2">
							<div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
							Saving...
						</span>
					) : isComplete ? (
						"Selection Saved"
					) : (
						"Save Selection"
					)}
				</button>
			</div>
		</div>
	);
}
