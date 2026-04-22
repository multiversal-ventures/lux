import { useEffect, useRef } from "react";

/**
 * Header bar with uploaded file name tabs, spanning from document sidebar to above document view.
 * Labels show the actual filename as uploaded (e.g. "tax_return_2024.pdf").
 * Snapshot style: document icon, tab label, theme (orange) underline for active.
 */

interface DocumentsYearHeaderProps {
	/** Uploaded files in order (file_id + filename for display) */
	files: Array<{ file_id: string; filename: string }>;
	selectedFileId: string | null;
	onFileSelect: (fileId: string) => void;
}

export function DocumentsYearHeader({
	files,
	selectedFileId,
	onFileSelect,
}: DocumentsYearHeaderProps) {
	const selectedTabRef = useRef<HTMLButtonElement | null>(null);

	// Scroll the selected tab into view when selection changes (e.g. via left/right arrows)
	useEffect(() => {
		if (selectedFileId && selectedTabRef.current) {
			selectedTabRef.current.scrollIntoView({
				inline: "center",
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [selectedFileId]);

	if (files.length === 0) return null;

	const selectedIndex =
		selectedFileId != null ? files.findIndex((f) => f.file_id === selectedFileId) : -1;
	const index = selectedIndex >= 0 ? selectedIndex : 0;
	const canGoLeft = index > 0;
	const canGoRight = index < files.length - 1;

	const goLeft = () => {
		if (canGoLeft) onFileSelect(files[index - 1].file_id);
	};
	const goRight = () => {
		if (canGoRight) onFileSelect(files[index + 1].file_id);
	};

	return (
		<div className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-0 bg-white border-b border-slate-200">
			<button
				type="button"
				onClick={goLeft}
				disabled={!canGoLeft}
				title="Previous document (left)"
				className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
			>
				<svg
					className="w-5 h-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
				</svg>
			</button>
			<div className="scrollbar-hide flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
				{files.map((file) => {
					const label = file.filename || file.file_id;
					const isSelected = selectedFileId === file.file_id;
					return (
						<button
							key={file.file_id}
							ref={isSelected ? selectedTabRef : undefined}
							type="button"
							onClick={() => onFileSelect(file.file_id)}
							className={`flex items-center gap-1.5 px-2 py-2 text-sm font-medium whitespace-nowrap transition-all border-b-2 shrink-0 ${
								isSelected
									? "text-slate-800 border-orange-500 bg-orange-50"
									: "text-slate-500 hover:text-slate-700 border-transparent hover:bg-slate-50/50"
							}`}
						>
							<svg
								className="w-4 h-4 shrink-0 text-slate-500"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
								/>
							</svg>
							<span className="truncate max-w-[180px]" title={label}>
								{label}
							</span>
						</button>
					);
				})}
			</div>
			<button
				type="button"
				onClick={goRight}
				disabled={!canGoRight}
				title="Next document (right)"
				className="shrink-0 p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors"
			>
				<svg
					className="w-5 h-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2}
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</div>
	);
}
