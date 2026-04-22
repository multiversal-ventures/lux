import { useCallback, useEffect, useRef, useState } from "react";

interface UploadingFile {
	name: string;
	size: number;
	progress: number; // 0-100
	status: "pending" | "uploading" | "complete" | "error";
}

type UploadPhase = "idle" | "preparing" | "uploading" | "starting" | "complete" | "error";

interface DropZoneProps {
	onFilesSelected: (files: File[]) => void;
	loading?: boolean;
	uploadingFiles?: UploadingFile[];
	uploadProgress?: number; // Overall progress 0-100
	uploadPhase?: UploadPhase; // Current phase of upload
	accept?: string;
	className?: string;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PDFIcon({ className = "w-5 h-5" }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
				fill="#EF4444"
				fillOpacity="0.1"
				stroke="#EF4444"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M14 2V8H20"
				stroke="#EF4444"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<text x="7" y="17" fontSize="5" fontWeight="bold" fill="#EF4444">
				PDF
			</text>
		</svg>
	);
}

function getPhaseMessage(phase: UploadPhase, fileCount: number): string {
	switch (phase) {
		case "preparing":
			return "Preparing upload...";
		case "uploading":
			return `Uploading ${fileCount} file${fileCount > 1 ? "s" : ""} to cloud...`;
		case "starting":
			return "Starting analysis...";
		case "complete":
			return "Upload complete!";
		case "error":
			return "Upload failed";
		default:
			return "Uploading...";
	}
}

export function DropZone({
	onFilesSelected,
	loading = false,
	uploadingFiles = [],
	uploadProgress,
	uploadPhase = "idle",
	accept = ".pdf",
	className = "",
}: DropZoneProps) {
	const [dragOver, setDragOver] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const currentFileRef = useRef<HTMLDivElement>(null);
	const currentUploadingIndex = uploadingFiles.findIndex((f) => f.status === "uploading");

	useEffect(() => {
		if (currentUploadingIndex >= 0 && currentFileRef.current) {
			const el = currentFileRef.current;
			requestAnimationFrame(() => {
				el.scrollIntoView({ behavior: "smooth", block: "center" });
			});
		}
	}, [currentUploadingIndex]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDragOver(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setDragOver(false);

			const files = Array.from(e.dataTransfer.files).filter(
				(file) => file.type === "application/pdf" || file.name.endsWith(".pdf"),
			);

			if (files.length > 0) {
				onFilesSelected(files);
			}
		},
		[onFilesSelected],
	);

	const handleClick = () => {
		if (!loading) {
			inputRef.current?.click();
		}
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const input = e.target;
		const files = input.files ? Array.from(input.files) : [];
		if (files.length > 0) {
			onFilesSelected(files);
		}
		// Allow selecting the same file(s) again in a later pick.
		input.value = "";
	};

	return (
		<div
			className={`drop-zone text-center p-4 ${loading ? "cursor-wait" : "cursor-pointer"} ${dragOver ? "dragover" : ""} ${className}`}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			onClick={handleClick}
		>
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				multiple
				onChange={handleFileChange}
				className="hidden"
				disabled={loading}
			/>

			{loading && uploadingFiles.length > 0 ? (
				<div className="flex flex-col items-center">
					{/* Upload header with phase indicator */}
					<div className="flex items-center gap-2 mb-2">
						<div className="rounded-lg bg-orange-100 flex items-center justify-center w-6 h-6">
							{uploadPhase === "complete" ? (
								<svg
									className="w-4 h-4 text-green-500"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M5 13l4 4L19 7"
									/>
								</svg>
							) : (
								<svg
									className="w-4 h-4 text-orange-500 animate-pulse"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={2}
										d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
									/>
								</svg>
							)}
						</div>
						<span className="font-semibold text-slate-700 text-sm">
							{getPhaseMessage(uploadPhase, uploadingFiles.length)}
						</span>
					</div>

					{/* Overall progress bar */}
					<div className="w-full max-w-md mb-3">
						<div className="flex justify-between text-xs text-slate-500 mb-1">
							<span>
								{uploadPhase === "preparing" && "Getting upload URLs..."}
								{uploadPhase === "uploading" &&
									`${uploadingFiles.filter((f) => f.status === "complete").length}/${uploadingFiles.length} files`}
								{uploadPhase === "starting" && "Verifying files..."}
								{uploadPhase === "complete" && "All files uploaded"}
							</span>
							<span>
								{uploadProgress !== undefined ? `${Math.round(uploadProgress)}%` : "Processing..."}
							</span>
						</div>
						<div className="h-2 bg-slate-200 rounded-full overflow-hidden">
							<div
								className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-300 ease-out"
								style={{ width: `${uploadProgress ?? 0}%` }}
							/>
						</div>
					</div>

					{/* File list with per-file progress - own scroll container so scrollIntoView works */}
					<div className="w-full max-w-md max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
						{uploadingFiles.map((file, idx) => (
							<div
								key={idx}
								ref={currentUploadingIndex === idx ? currentFileRef : undefined}
								className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 shadow-sm p-2"
							>
								<div className="flex-shrink-0 rounded-lg bg-red-50 flex items-center justify-center w-8 h-8">
									<PDFIcon className="w-4 h-4" />
								</div>
								<div className="flex-1 min-w-0 text-left">
									<p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
									<div className="flex items-center gap-2">
										<p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
										{file.status === "uploading" && (
											<span className="text-xs text-orange-500">{file.progress}%</span>
										)}
									</div>
									{/* Per-file progress bar when uploading */}
									{file.status === "uploading" && (
										<div className="mt-1 h-1 bg-slate-100 rounded-full overflow-hidden">
											<div
												className="h-full bg-orange-400 rounded-full transition-all duration-200"
												style={{ width: `${file.progress}%` }}
											/>
										</div>
									)}
								</div>
								<div className="flex-shrink-0">
									{file.status === "pending" && (
										<div className="w-5 h-5 rounded-full border-2 border-slate-200" />
									)}
									{file.status === "uploading" && (
										<div className="w-5 h-5 rounded-full border-2 border-orange-200 border-t-orange-500 animate-spin" />
									)}
									{file.status === "complete" && (
										<svg
											className="w-5 h-5 text-green-500"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M5 13l4 4L19 7"
											/>
										</svg>
									)}
									{file.status === "error" && (
										<svg
											className="w-5 h-5 text-red-500"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			) : loading ? (
				<div className="flex flex-col items-center">
					<div className="spinner mb-4" />
					<p className="text-slate-600 font-medium">Uploading...</p>
				</div>
			) : (
				<>
					<div className="mx-auto rounded-2xl bg-orange-100 flex items-center justify-center w-12 h-12 mb-2">
						<svg
							className="w-6 h-6 text-orange-500"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={1.5}
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
					</div>
					<p className="font-semibold text-slate-700 mb-1 text-base">Drop documents here</p>
					<p className="text-slate-500 text-xs mb-1">or click to browse</p>
					<p className="text-xs text-slate-400">Supports PDF files</p>
				</>
			)}
		</div>
	);
}
