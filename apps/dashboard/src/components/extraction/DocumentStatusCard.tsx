import { FileText, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtractedDocument, StreamEvent } from "../../types";

interface DocumentStatusCardProps {
	documents: ExtractedDocument[];
	isExtracting?: boolean;
	isAnimating?: boolean;
	events?: StreamEvent[];
}

function formatDocumentType(type: string): string {
	return type
		.replace(/^IRS/, "")
		.replace(/Schedule/g, "Sch ")
		.replace(/VerificationOf/g, "VOE: ")
		.trim();
}

const DOC_CATEGORIES: Record<string, string[]> = {
	"Tax Returns": ["IRS1040", "IRS1120", "IRS1120S", "IRS1065", "TaxReturn"],
	Schedules: ["Schedule", "Sch"],
	"W-2 & 1099": ["IRSW2", "IRS1099"],
	Income: ["PayStub", "ProfitLoss", "VerificationOfEmployment", "VerificationOfIncome"],
	Banking: ["BankStatement"],
	"K-1": ["ScheduleK1"],
};

function categorize(type: string): string {
	for (const [cat, patterns] of Object.entries(DOC_CATEGORIES)) {
		if (patterns.some((p) => type.includes(p))) return cat;
	}
	return "Other";
}

export function DocumentStatusCard({
	documents,
	isExtracting = false,
	events = [],
}: DocumentStatusCardProps) {
	const [realTimeFoundTypes, setRealTimeFoundTypes] = useState<Set<string>>(new Set());
	const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
	const processedEventsRef = useRef<Set<string>>(new Set());

	useEffect(() => {
		events.forEach((event) => {
			if (processedEventsRef.current.has(event.id)) return;
			processedEventsRef.current.add(event.id);

			const documentClass =
				(event.data?.document_class as string) || (event.source?.document_class as string);
			if (documentClass) {
				setRealTimeFoundTypes((prev) => new Set(prev).add(documentClass));
				setRecentlyAdded((prev) => new Set(prev).add(documentClass));
				setTimeout(() => {
					setRecentlyAdded((prev) => {
						const next = new Set(prev);
						next.delete(documentClass);
						return next;
					});
				}, 2000);
			}
		});
	}, [events]);

	const foundDocs = useMemo(() => {
		const counts = new Map<string, number>();
		documents.forEach((doc) => {
			const t = doc.document_type;
			counts.set(t, (counts.get(t) || 0) + 1);
		});
		realTimeFoundTypes.forEach((t) => {
			if (!counts.has(t)) counts.set(t, 0);
		});

		const entries = Array.from(counts.entries()).map(([type, count]) => ({
			type,
			count,
			displayName: formatDocumentType(type),
			category: categorize(type),
			isNew: recentlyAdded.has(type),
		}));

		entries.sort(
			(a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName),
		);
		return entries;
	}, [documents, realTimeFoundTypes, recentlyAdded]);

	const grouped = useMemo(() => {
		const map = new Map<string, typeof foundDocs>();
		foundDocs.forEach((d) => {
			const arr = map.get(d.category) || [];
			arr.push(d);
			map.set(d.category, arr);
		});
		return map;
	}, [foundDocs]);

	const hasFound = foundDocs.length > 0;

	return (
		<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
			{/* Header */}
			<div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
				<div className="flex items-center gap-2">
					<FileText className="w-4 h-4 text-slate-400" />
					<span className="text-sm font-medium text-slate-700">Documents Found</span>
					{hasFound && (
						<span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full tabular-nums">
							{foundDocs.length}
						</span>
					)}
				</div>
				{isExtracting && (
					<span className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium">
						<Search className="w-3 h-3 animate-pulse" />
						Scanning...
					</span>
				)}
			</div>

			{/* Body */}
			<div className="p-5">
				{!hasFound && isExtracting ? (
					<div className="flex flex-col items-center justify-center py-8 text-center">
						<div className="relative mb-4">
							<div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
								<Search className="w-5 h-5 text-amber-500" />
							</div>
							<div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-amber-300 animate-ping opacity-20" />
						</div>
						<p className="text-sm font-medium text-slate-600">Identifying document types...</p>
						<p className="text-xs text-slate-400 mt-1">
							Documents will appear here as they are classified
						</p>
					</div>
				) : !hasFound ? (
					<p className="text-sm text-slate-400 text-center py-4">No documents found yet</p>
				) : (
					<div className="space-y-4">
						{Array.from(grouped.entries()).map(([category, docs]) => (
							<div key={category}>
								<p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
									{category}
								</p>
								<div className="flex flex-wrap gap-1.5">
									{docs.map(({ type, count, displayName, isNew }) => (
										<span
											key={type}
											className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all duration-300 ${
												isNew
													? "bg-emerald-100 text-emerald-800 border-emerald-300 ring-2 ring-emerald-200 ring-opacity-50 animate-pulse"
													: "bg-emerald-50 text-emerald-700 border-emerald-200"
											}`}
											title={type}
										>
											{displayName}
											{count > 1 && (
												<span className="text-[9px] bg-emerald-200 text-emerald-800 px-1 py-px rounded-full font-semibold tabular-nums">
													{count}
												</span>
											)}
										</span>
									))}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
