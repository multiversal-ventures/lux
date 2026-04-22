import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeIdTokenChange } from "../../lib/firebase";
import { getPageImageUrl } from "../../hooks/useApi";
import type { DocumentPageRef, FactSource } from "../../types";

interface SimpleDocumentCanvasProps {
	caseId: string;
	pages: DocumentPageRef[];
	highlightedSources: FactSource[];
	highlightedPage: number | null;
	/** Increments when a fact is clicked in sidebar; triggers scroll to that fact */
	scrollToFactTag?: number;
}

function isSameBox(a: FactSource["bbox"], b: FactSource["bbox"]): boolean {
	if (!a || !b) return false;
	return (
		Math.abs(a.x1 - b.x1) < 0.001 &&
		Math.abs(a.y1 - b.y1) < 0.001 &&
		Math.abs(a.x2 - b.x2) < 0.001 &&
		Math.abs(a.y2 - b.y2) < 0.001
	);
}

export function SimpleDocumentCanvas({
	caseId,
	pages,
	highlightedSources,
	highlightedPage,
	scrollToFactTag,
}: SimpleDocumentCanvasProps) {
	const [authToken, setAuthToken] = useState<string | undefined>(undefined);
	const [authReady, setAuthReady] = useState(false);
	const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const primaryFactRef = useRef<HTMLDivElement | null>(null);

	const sortedPages = useMemo(
		() => [...pages].sort((a, b) => a.page_number - b.page_number),
		[pages],
	);

	useEffect(() => {
		const unsubscribe = subscribeIdTokenChange(async (user) => {
			if (user) {
				const token = await user.getIdToken();
				setAuthToken(token);
			} else {
				setAuthToken(undefined);
			}
			setAuthReady(true);
		});
		return () => unsubscribe();
	}, []);

	useEffect(() => {
		if (!highlightedPage) return;
		const pageEl = pageRefs.current.get(highlightedPage);
		if (pageEl) {
			pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [highlightedPage]);

	useEffect(() => {
		if (scrollToFactTag == null || scrollToFactTag === 0) return;
		const el = primaryFactRef.current;
		if (el) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		} else if (highlightedPage) {
			const pageEl = pageRefs.current.get(highlightedPage);
			if (pageEl) pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}, [scrollToFactTag, highlightedPage]);

	if (!authReady) {
		return (
			<div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-100">
				Loading document...
			</div>
		);
	}

	if (sortedPages.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center text-slate-500 bg-slate-100">
				Selected document has no pages.
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto bg-slate-100 p-4 space-y-4">
			{sortedPages.map((page) => {
				const imageUrl = getPageImageUrl(caseId, page.file_id, page.page_number, authToken);
				const sourceBoxes = highlightedSources.filter(
					(source) => source.page_number === page.page_number && source.bbox,
				);
				const hasAnyHighlight = highlightedPage === page.page_number;
				const hasOnlyPageHighlight =
					hasAnyHighlight &&
					sourceBoxes.length === 0 &&
					highlightedSources.some((source) => source.page_number === page.page_number);

				return (
					<div
						key={`${page.file_id}:${page.page_number}`}
						ref={(el) => {
							if (el) pageRefs.current.set(page.page_number, el);
						}}
						className="relative"
					>
						<div className="absolute top-2 left-2 z-10 px-2 py-1 text-xs rounded bg-slate-900/75 text-white">
							Page {page.page_number}
						</div>
						<div
							className={`relative rounded shadow-sm overflow-hidden ${
								hasAnyHighlight ? "ring-2 ring-orange-400" : "ring-1 ring-slate-300"
							}`}
						>
							<img src={imageUrl} alt={`Page ${page.page_number}`} className="block w-full" />

							{sourceBoxes.map((source, idx) => {
								const primarySource = highlightedSources[0];
								const isPrimary =
									primarySource &&
									source.page_number === primarySource.page_number &&
									isSameBox(primarySource.bbox, source.bbox);
								if (!source.bbox) return null;
								const left = `${source.bbox.x1 * 100}%`;
								const top = `${source.bbox.y1 * 100}%`;
								const width = `${(source.bbox.x2 - source.bbox.x1) * 100}%`;
								const height = `${(source.bbox.y2 - source.bbox.y1) * 100}%`;
								return (
									<div
										key={`${page.page_number}:${idx}`}
										ref={isPrimary ? primaryFactRef : undefined}
										className={`absolute pointer-events-none ${
											isPrimary
												? "border-2 border-orange-500 bg-orange-400/20"
												: "border border-orange-300 bg-orange-300/15"
										}`}
										style={{ left, top, width, height }}
									/>
								);
							})}

							{hasOnlyPageHighlight && (
								<div className="absolute top-2 right-2 z-10 px-2 py-1 text-xs rounded bg-orange-500 text-white">
									Fact on this page
								</div>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
