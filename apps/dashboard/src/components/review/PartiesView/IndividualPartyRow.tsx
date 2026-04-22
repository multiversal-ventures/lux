import { Combine, User, UserRound, UserX } from "lucide-react";
import type { ExtractedDocument } from "../../../types";
import { BusinessEntityRow } from "./BusinessEntityRow";
import type { BorrowerRole, PartyType } from "./partiesViewTypes";
import {
	formatIdentifier,
	formatPartyName,
	getDocTypeDisplay,
	getTopSourceRef,
} from "./partiesViewUtils";
import type { PartyWithId } from "./usePartiesViewState";

const DocIcon = () => (
	<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
		/>
	</svg>
);

const WarningIcon = () => (
	<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
		<path
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
		/>
	</svg>
);

export interface IndividualPartyRowProps {
	party: PartyWithId;
	partyDocs: ExtractedDocument[];
	isExpanded: boolean;
	role: BorrowerRole;
	getPartyType: (party: PartyWithId) => PartyType;
	needsReview: boolean;
	recentlyMerged: boolean;
	nestedBusinesses: PartyWithId[];
	getPartyDocuments: (party: PartyWithId) => ExtractedDocument[];
	onToggleExpanded: () => void;
	onRoleChange: (role: BorrowerRole) => void;
	onTogglePartyType: (partyId: string) => void;
	onEdit: () => void;
	onMerge: () => void;
	onNavigateToDocument: (doc: ExtractedDocument) => void;
	onNavigateToSource?: (fileId: string, page: number) => void;
}

export function IndividualPartyRow({
	party,
	partyDocs,
	isExpanded,
	role,
	getPartyType,
	needsReview,
	recentlyMerged,
	nestedBusinesses,
	getPartyDocuments,
	onToggleExpanded,
	onRoleChange,
	onTogglePartyType,
	onEdit,
	onMerge,
	onNavigateToDocument,
	onNavigateToSource,
}: IndividualPartyRowProps) {
	const topSourceRef = getTopSourceRef(party);
	const isIndividual = getPartyType(party) !== "business";

	return (
		<div
			className={`group ${
				recentlyMerged ? "ring-2 ring-purple-500 ring-inset bg-purple-50 animate-pulse" : ""
			}`}
		>
			<div
				onClick={onToggleExpanded}
				className="flex items-center justify-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
			>
				<div
					className={`w-8 h-8 rounded-full flex items-center justify-center ${
						role === "primary"
							? "bg-slate-800"
							: role === "co_borrower"
								? "bg-slate-100 ring-2 ring-slate-300"
								: "bg-slate-100"
					}`}
				>
					{role === "primary" ? (
						<User className="w-4 h-4 text-white" strokeWidth={2.5} />
					) : role === "co_borrower" ? (
						<UserRound className="w-4 h-4 text-slate-600" strokeWidth={2} />
					) : (
						<UserX className="w-4 h-4 text-slate-400" strokeWidth={1.5} />
					)}
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3 flex-wrap">
							<div>
								<div className="flex items-center gap-2 flex-wrap">
									<div>
										<span
											className={`font-medium ${
												!role || role === "ignore" ? "text-slate-400" : "text-slate-800"
											}`}
										>
											{formatPartyName(party.name)}
										</span>
										{topSourceRef &&
											(topSourceRef.file_id && onNavigateToSource ? (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onNavigateToSource(topSourceRef.file_id!, topSourceRef.page ?? 1);
													}}
													className="flex items-center gap-0.5 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
													title={`Go to ${getDocTypeDisplay(topSourceRef.docType)}`}
												>
													<DocIcon />
													{getDocTypeDisplay(topSourceRef.docType)}
												</button>
											) : (
												<span className="flex items-center gap-0.5 text-[10px] text-slate-400">
													<DocIcon />
													{getDocTypeDisplay(topSourceRef.docType)}
												</span>
											))}
									</div>
									{party.name_aliases && party.name_aliases.length > 0 && (
										<span
											className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded"
											title={`Also known as: ${party.name_aliases.join(", ")}`}
										>
											<Combine className="w-3 h-3" />
											Merged
										</span>
									)}
								</div>
								<div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
									{party.identifiers &&
										Object.entries(party.identifiers).map(([key, value], i) => (
											<span key={`${key}-${i}`} className="flex items-center gap-1">
												<span className="uppercase font-medium">{key}:</span>
												<span className="font-mono">{formatIdentifier(key, value)}</span>
											</span>
										))}
								</div>
								{party.name_aliases && party.name_aliases.length > 0 && (
									<div className="text-xs text-purple-600 mt-0.5">
										Aliases: {party.name_aliases.map(formatPartyName).join(", ")}
									</div>
								)}
								{needsReview && (
									<span
										className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded mt-1"
										title="This party has a similar SSN to another - please verify"
									>
										<WarningIcon />
										Review
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
					<div className="flex items-center gap-2 text-xs">
						<span
							className={`transition-colors duration-200 ${
								isIndividual ? "text-amber-600 font-medium" : "text-slate-400"
							}`}
						>
							Individual
						</span>
						<button
							type="button"
							role="switch"
							aria-checked={isIndividual}
							onClick={() => onTogglePartyType(party._id)}
							className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ease-in-out hover:shadow-md ${
								isIndividual ? "bg-amber-500 hover:bg-amber-600" : "bg-slate-300 hover:bg-slate-400"
							}`}
						>
							<span
								className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-all duration-200 ease-in-out ${
									isIndividual ? "translate-x-[18px] scale-110" : "translate-x-1"
								}`}
							/>
						</button>
					</div>
					<button
						type="button"
						onClick={onEdit}
						className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
						title="Edit name"
					>
						<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
							/>
						</svg>
					</button>
					<button
						type="button"
						onClick={onMerge}
						className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
						title="Merge with another party"
					>
						<Combine className="w-3.5 h-3.5" />
						Merge
					</button>
				</div>

				<div className="flex items-center gap-2 px-4 ml-auto" onClick={(e) => e.stopPropagation()}>
					<div className="flex items-center gap-3">
						<span className="text-sm text-slate-500">
							{partyDocs.length} {partyDocs.length === 1 ? "document" : "documents"}
						</span>
						<div className="relative">
							<select
								value={role}
								onChange={(e) => onRoleChange(e.target.value as BorrowerRole)}
								className="pl-3 pr-8 py-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all appearance-none"
							>
								<option value="primary">Primary</option>
								<option value="co_borrower">Co-Borrower</option>
								<option value="ignore">Ignore</option>
							</select>
							<svg
								className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</div>
					</div>
				</div>
			</div>

			{isExpanded && (
				<div className="px-4 pb-4">
					<div className="ml-13 pl-4 border-l-2 border-slate-200 space-y-3">
						{nestedBusinesses.length > 0 && (
							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
									Business Entities
								</div>
								{nestedBusinesses.map((biz, bidx) => (
									<BusinessEntityRow
										key={`${biz._id}-${bidx}`}
										business={biz}
										docCount={getPartyDocuments(biz).length}
										getPartyType={getPartyType}
										onTogglePartyType={onTogglePartyType}
										compact
									/>
								))}
							</div>
						)}
						{partyDocs.length > 0 && (
							<div className="space-y-2">
								<div className="text-xs font-medium text-slate-400 uppercase tracking-wide">
									Documents
								</div>
								{partyDocs.map((doc, i) => (
									<button
										key={`${doc.document_type}-${i}`}
										type="button"
										onClick={() => onNavigateToDocument(doc)}
										className="w-full flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-blue-50 hover:border-blue-200 border border-transparent transition-colors cursor-pointer"
									>
										<div className="flex items-center gap-2">
											<span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
												{getDocTypeDisplay(doc.document_type)}
											</span>
											<span className="text-sm text-slate-600">
												{doc.effective_period?.period_start?.slice(0, 4) ?? "N/A"}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-xs text-slate-500">{doc.facts_count} facts</span>
											<svg
												className="w-4 h-4 text-slate-400"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M9 5l7 7-7 7"
												/>
											</svg>
										</div>
									</button>
								))}
							</div>
						)}
						{partyDocs.length === 0 && nestedBusinesses.length === 0 && (
							<p className="text-sm text-slate-400 py-2">
								No documents or businesses linked to this party
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
