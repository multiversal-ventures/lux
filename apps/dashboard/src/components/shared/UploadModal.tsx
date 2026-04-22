import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type AddFilesProgress, addFilesToCase } from "../../hooks/useApi";
import { DropZone } from "../upload/DropZone";

interface UploadModalProps {
	caseId: string;
	isOpen: boolean;
	onClose: () => void;
	onUploadComplete: (uploadedFiles: string[]) => void;
}

interface UploadingFile {
	name: string;
	size: number;
	progress: number;
	status: "pending" | "uploading" | "complete" | "error";
}

export function UploadModal({ caseId, isOpen, onClose, onUploadComplete }: UploadModalProps) {
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [uploading, setUploading] = useState(false);
	const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [uploadPhase, setUploadPhase] = useState<
		"idle" | "preparing" | "uploading" | "starting" | "complete" | "error"
	>("idle");
	const [error, setError] = useState<string | null>(null);

	// Reset state when modal opens
	useEffect(() => {
		if (isOpen) {
			setSelectedFiles([]);
			setUploading(false);
			setUploadingFiles([]);
			setUploadProgress(0);
			setUploadPhase("idle");
			setError(null);
		}
	}, [isOpen]);

	const handleFilesSelected = useCallback((files: File[]) => {
		setSelectedFiles(files);
		setError(null);
	}, []);

	const handleUpload = useCallback(async () => {
		if (selectedFiles.length === 0) return;

		setUploading(true);
		setError(null);

		// Initialize uploading files state
		setUploadingFiles(
			selectedFiles.map((f) => ({
				name: f.name,
				size: f.size,
				progress: 0,
				status: "pending" as const,
			})),
		);

		try {
			await addFilesToCase(caseId, selectedFiles, (progress: AddFilesProgress) => {
				setUploadPhase(progress.phase);

				// Calculate overall progress
				const phaseProgress: Record<string, number> = {
					preparing: 10,
					uploading: 10 + (progress.completedFiles / progress.totalFiles) * 70,
					starting: 85,
					complete: 100,
				};
				setUploadProgress(phaseProgress[progress.phase] ?? 0);

				// Update per-file status
				if (progress.phase === "uploading") {
					setUploadingFiles((prev) =>
						prev.map((f, i) => ({
							...f,
							status:
								i < progress.completedFiles
									? "complete"
									: i === progress.completedFiles
										? "uploading"
										: "pending",
							progress:
								i < progress.completedFiles
									? 100
									: i === progress.completedFiles
										? progress.currentFileProgress
										: 0,
						})),
					);
				} else if (progress.phase === "complete") {
					setUploadingFiles((prev) =>
						prev.map((f) => ({
							...f,
							status: "complete",
							progress: 100,
						})),
					);
				}
			});

			// Success - notify parent with uploaded file names and close
			onUploadComplete(selectedFiles.map((f) => f.name));
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
			setUploadPhase("error");
			setUploadingFiles((prev) =>
				prev.map((f) => ({
					...f,
					status: f.status === "complete" ? "complete" : "error",
				})),
			);
		} finally {
			setUploading(false);
		}
	}, [caseId, selectedFiles, onUploadComplete, onClose]);

	const handleClose = useCallback(() => {
		if (!uploading) {
			onClose();
		}
	}, [uploading, onClose]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
			onClick={handleClose}
		>
			<div
				className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
					<h2 className="text-lg font-semibold text-slate-800">Upload Documents</h2>
					{!uploading && (
						<button
							onClick={handleClose}
							className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
						>
							<X className="w-5 h-5 text-slate-500" />
						</button>
					)}
				</div>

				{/* Content */}
				<div className="p-6">
					{error && (
						<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
							{error}
						</div>
					)}

					<DropZone
						onFilesSelected={handleFilesSelected}
						loading={uploading}
						uploadingFiles={uploadingFiles}
						uploadProgress={uploadProgress}
						uploadPhase={uploadPhase}
						accept=".pdf"
					/>

					{/* Selected files preview (before upload) */}
					{selectedFiles.length > 0 && !uploading && (
						<div className="mt-4">
							<p className="text-sm text-slate-600 mb-2">
								{selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected
							</p>
							<div className="space-y-2 max-h-32 overflow-y-auto">
								{selectedFiles.map((file, idx) => (
									<div
										key={idx}
										className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-sm"
									>
										<span className="text-slate-700 truncate flex-1">{file.name}</span>
										<span className="text-slate-400 flex-shrink-0">
											{(file.size / 1024 / 1024).toFixed(1)} MB
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
					<button
						onClick={handleClose}
						disabled={uploading}
						className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						onClick={handleUpload}
						disabled={uploading || selectedFiles.length === 0}
						className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{uploading ? "Uploading..." : "Upload"}
					</button>
				</div>
			</div>
		</div>
	);
}
