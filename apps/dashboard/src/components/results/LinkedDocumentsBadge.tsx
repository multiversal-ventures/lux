import type { DocumentLink } from "../../types";

interface LinkedDocumentsBadgeProps {
	links: DocumentLink[];
	onNavigate: (fileId: string, documentType: string) => void;
}

/**
 * Badge displaying linked documents with relationship info.
 * Shows in document cards when documents are linked via entity matching.
 */
export function LinkedDocumentsBadge({ links, onNavigate }: LinkedDocumentsBadgeProps) {
	if (!links || links.length === 0) return null;

	const hasAmbiguous = links.some((link) => link.ambiguous);
	const hasWarnings = links.some((link) => link.warnings && link.warnings.length > 0);
	const primaryLink = links[0];

	// Relationship type icons and colors
	const relationshipStyles = {
		belongs_to: { icon: "↑", color: "text-blue-600", label: "belongs to" },
		supports: { icon: "→", color: "text-purple-600", label: "supports" },
		references: { icon: "⇄", color: "text-slate-600", label: "references" },
	};

	const style =
		relationshipStyles[primaryLink.relationship_type as keyof typeof relationshipStyles] ||
		relationshipStyles.references;

	// Compile tooltip text
	let titleText = `${style.label} ${getDocDisplayName(primaryLink.linked_document_type)}`;
	if (primaryLink.warnings && primaryLink.warnings.length > 0) {
		titleText += `\n\n⚠️ ${primaryLink.warnings.join("\n")}`;
	}

	return (
		<div className="inline-flex items-center gap-1">
			{/* Linked badge */}
			<div
				onClick={(e) => {
					e.stopPropagation();
					onNavigate(primaryLink.linked_file_id, primaryLink.linked_document_type);
				}}
				className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
					hasAmbiguous
						? "bg-amber-100 text-amber-700 hover:bg-amber-200"
						: hasWarnings
							? "bg-orange-50 text-orange-700 hover:bg-orange-100"
							: "bg-blue-50 text-blue-700 hover:bg-blue-100"
				}`}
				title={titleText}
			>
				<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
				<span className={style.color}>{style.icon}</span>
				<span>{getDocDisplayName(primaryLink.linked_document_type)}</span>
				{links.length > 1 && <span className="ml-0.5 opacity-60">+{links.length - 1}</span>}
				{hasWarnings && (
					<svg
						className="w-3 h-3 text-orange-600"
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
				)}
			</div>

			{/* Ambiguity warning */}
			{hasAmbiguous && (
				<span
					className="inline-flex items-center text-[10px] text-amber-600"
					title={`${links.length} possible matches - review needed`}
				>
					<svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
				</span>
			)}
		</div>
	);
}

/**
 * Detailed panel showing all linked documents with match information.
 * Used in expanded view or modal.
 */
interface LinkedDocumentsPanelProps {
	links: DocumentLink[];
	onNavigate: (fileId: string, documentType: string) => void;
}

export function LinkedDocumentsPanel({ links, onNavigate }: LinkedDocumentsPanelProps) {
	if (!links || links.length === 0) return null;

	const hasAmbiguous = links.some((link) => link.ambiguous);

	return (
		<div className="mt-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
			{/* Header */}
			<div className="flex items-center gap-2 mb-2">
				<svg
					className="w-4 h-4 text-slate-500"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.102m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
				<span className="text-xs font-medium text-slate-700">
					Linked Documents ({links.length})
				</span>
				{hasAmbiguous && (
					<span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
						Review Needed
					</span>
				)}
			</div>

			{/* Ambiguity warning */}
			{hasAmbiguous && (
				<div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
					<div className="flex items-start gap-1.5">
						<svg
							className="w-4 h-4 shrink-0 mt-0.5"
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
						<div>
							<p className="font-medium">Multiple matches found</p>
							<p className="text-[11px] opacity-80 mt-0.5">
								This document matches {links.length} other documents. Review the matches below to
								verify the correct relationship.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Links list */}
			<div className="space-y-1.5">
				{links.map((link, idx) => (
					<button
						key={`${link.linked_file_id}-${idx}`}
						onClick={() => onNavigate(link.linked_file_id, link.linked_document_type)}
						className="w-full p-2 bg-white rounded border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
					>
						<div className="flex items-start justify-between gap-2">
							<div className="flex-1 min-w-0">
								{/* Document type */}
								<div className="flex items-center gap-1.5 mb-1">
									<span className="text-xs font-medium text-slate-700 truncate">
										{getDocDisplayName(link.linked_document_type)}
									</span>
									{link.ambiguous && (
										<span className="shrink-0 px-1 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-medium rounded">
											AMBIGUOUS
										</span>
									)}
								</div>

								{/* Relationship type */}
								<div className="text-[10px] text-slate-500 mb-1">
									{link.relationship_type.replace("_", " ")}
								</div>

								{/* Warnings */}
								{link.warnings && link.warnings.length > 0 && (
									<div className="mb-1 p-1 bg-orange-50 border border-orange-200 rounded">
										{link.warnings.map((warning, wIdx) => (
											<div
												key={wIdx}
												className="flex items-start gap-1 text-[10px] text-orange-800"
											>
												<svg
													className="w-3 h-3 shrink-0 mt-0.5"
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
												<span className="flex-1">{warning}</span>
											</div>
										))}
									</div>
								)}

								{/* Matched entities */}
								<div className="flex flex-wrap gap-1">
									{Object.entries(link.matched_entities).map(([field, value]) => (
										<span
											key={field}
											className="px-1 py-0.5 bg-green-50 text-green-700 text-[9px] rounded font-mono"
											title={`${field}: ${value}`}
										>
											{field.replace(/_/g, " ")}
										</span>
									))}
								</div>
							</div>

							{/* Confidence score */}
							<div className="shrink-0 text-right">
								<div className="text-[10px] text-slate-400 mb-0.5">match</div>
								<div
									className={`text-xs font-bold ${
										link.confidence >= 0.95
											? "text-green-600"
											: link.confidence >= 0.8
												? "text-blue-600"
												: "text-amber-600"
									}`}
								>
									{Math.round(link.confidence * 100)}%
								</div>
							</div>
						</div>

						{/* Click hint */}
						<div className="mt-1 text-[9px] text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
							Click to navigate →
						</div>
					</button>
				))}
			</div>
		</div>
	);
}

// Helper to get display name for document types
function getDocDisplayName(docType: string): string {
	const mapping: Record<string, string> = {
		IRS1040: "Form 1040",
		IRS1065: "Form 1065",
		IRS1065ScheduleK1: "Schedule K-1 (1065)",
		IRSScheduleK1Form1065: "Schedule K-1 (1065)", // Classifier output name
		IRS1120S: "Form 1120-S",
		IRS1120SScheduleK1: "Schedule K-1 (1120-S)",
		IRSScheduleK1Form1120S: "Schedule K-1 (1120-S)", // Classifier output name
		IRS1120: "Form 1120",
		IRS1040ScheduleC: "Schedule C",
		IRS1040ScheduleE: "Schedule E",
		IRS1040ScheduleF: "Schedule F",
		IRSW2: "W-2",
	};

	return (
		mapping[docType] ||
		docType
			.replace("IRS", "")
			.replace(/([A-Z])/g, " $1")
			.trim()
	);
}
