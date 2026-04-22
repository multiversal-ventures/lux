import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { reprocessCase } from "../../hooks/useApi";
import { useAppSelector } from "../../store";

interface ReprocessButtonProps {
	caseId: string;
}

export function ReprocessButton({ caseId }: ReprocessButtonProps) {
	const navigate = useNavigate();
	const [showMenu, setShowMenu] = useState(false);
	const [reprocessing, setReprocessing] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const selectedLoanProduct = useAppSelector((state) => state.app.selectedLoanProduct);

	const handleReprocessSameFiles = async () => {
		if (!caseId || reprocessing) return;
		setReprocessing(true);
		setShowMenu(false);
		try {
			const result = await reprocessCase(caseId, undefined, selectedLoanProduct, true);
			if (result.new_case_id !== caseId) {
				navigate(`/case/${result.new_case_id}`);
			} else {
				window.location.reload();
			}
		} catch (err) {
			console.error("Reprocess failed:", err);
			alert("Failed to reprocess case");
		} finally {
			setReprocessing(false);
		}
	};

	const handleUploadNewFiles = () => {
		setShowMenu(false);
		fileInputRef.current?.click();
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0 || !caseId) return;
		setReprocessing(true);
		try {
			const result = await reprocessCase(caseId, files, selectedLoanProduct, true);
			if (result.new_case_id !== caseId) {
				navigate(`/case/${result.new_case_id}`);
			} else {
				window.location.reload();
			}
		} catch (err) {
			console.error("Reprocess with new files failed:", err);
			alert("Failed to reprocess case with new files");
		} finally {
			setReprocessing(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setShowMenu(!showMenu)}
				disabled={reprocessing}
				className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
					reprocessing
						? "bg-slate-100 text-slate-400 cursor-not-allowed"
						: "bg-blue-50 text-blue-700 hover:bg-blue-100"
				}`}
			>
				{reprocessing ? (
					<>
						<svg
							className="w-4 h-4 animate-spin"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Reprocessing...
					</>
				) : (
					<>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Reprocess
						<svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M19 9l-7 7-7-7"
							/>
						</svg>
					</>
				)}
			</button>

			{showMenu && (
				<div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
					<button
						type="button"
						onClick={handleReprocessSameFiles}
						className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
					>
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
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						<div>
							<div className="font-medium text-slate-700">Same Files</div>
							<div className="text-xs text-slate-500">Re-run extraction on same case</div>
						</div>
					</button>
					<button
						type="button"
						onClick={handleUploadNewFiles}
						className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
					>
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
								d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
							/>
						</svg>
						<div>
							<div className="font-medium text-slate-700">Upload New Files</div>
							<div className="text-xs text-slate-500">Replace with new documents (same case)</div>
						</div>
					</button>
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept=".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp,.webp"
				className="hidden"
				onChange={handleFileChange}
			/>
		</div>
	);
}
