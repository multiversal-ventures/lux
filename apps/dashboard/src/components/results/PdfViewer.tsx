import { useState, useEffect } from "react";
import { getFileDownloadUrl } from "../../hooks/useApi";

interface PdfViewerProps {
	caseId: string;
	fileId: string;
	filename: string;
	/** Called when viewer is closed */
	onClose?: () => void;
}

/**
 * PdfViewer - Displays a PDF using a signed GCS URL.
 *
 * Shows the original uploaded PDF immediately, without waiting for
 * page-by-page extraction to complete.
 */
export function PdfViewer({ caseId, fileId, filename, onClose }: PdfViewerProps) {
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;

		async function fetchUrl() {
			try {
				setLoading(true);
				setError(null);
				const response = await getFileDownloadUrl(caseId, fileId);
				if (mounted) {
					setPdfUrl(response.download_url);
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err.message : "Failed to load PDF");
				}
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		}

		fetchUrl();

		return () => {
			mounted = false;
		};
	}, [caseId, fileId]);

	return (
		<div className="h-full flex flex-col bg-slate-900">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
				<div className="flex items-center gap-3">
					<svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
						<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.9,12.35 10.92,12.31Z" />
					</svg>
					<span className="text-white font-medium truncate max-w-md" title={filename}>
						{filename}
					</span>
				</div>

				<div className="flex items-center gap-2">
					{/* Open in new tab */}
					{pdfUrl && (
						<a
							href={pdfUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
							title="Open in new tab"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								/>
							</svg>
						</a>
					)}

					{/* Download */}
					{pdfUrl && (
						<a
							href={pdfUrl}
							download={filename}
							className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
							title="Download"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
								/>
							</svg>
						</a>
					)}

					{/* Close */}
					{onClose && (
						<button
							onClick={onClose}
							className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
							title="Close"
						>
							<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					)}
				</div>
			</div>

			{/* PDF Content */}
			<div className="flex-1 relative">
				{loading && (
					<div className="absolute inset-0 flex items-center justify-center bg-slate-900">
						<div className="flex flex-col items-center gap-3">
							<div className="spinner-white" />
							<span className="text-slate-400">Loading PDF...</span>
						</div>
					</div>
				)}

				{error && (
					<div className="absolute inset-0 flex items-center justify-center bg-slate-900">
						<div className="flex flex-col items-center gap-3 text-center px-8">
							<svg
								className="w-12 h-12 text-red-400"
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
							<span className="text-red-400">{error}</span>
							<button
								onClick={() => window.location.reload()}
								className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
							>
								Retry
							</button>
						</div>
					</div>
				)}

				{pdfUrl && !loading && !error && (
					<object
						data={`${pdfUrl}#view=FitH`}
						type="application/pdf"
						className="w-full h-full"
						title={filename}
					>
						{/* Fallback if object doesn't work */}
						<embed src={`${pdfUrl}#view=FitH`} type="application/pdf" className="w-full h-full" />
					</object>
				)}
			</div>
		</div>
	);
}

/**
 * Compact file card for the file list.
 * Shows file info and opens PDF viewer when clicked.
 */
interface FileCardProps {
	fileId: string;
	filename: string;
	pageCount: number;
	status: "loading" | "classifying" | "extracting" | "complete";
	selected?: boolean;
	onClick?: () => void;
}

export function FileCard({
	fileId: _fileId,
	filename,
	pageCount,
	status,
	selected,
	onClick,
}: FileCardProps) {
	const statusColors = {
		loading: "bg-slate-100 text-slate-600",
		classifying: "bg-blue-100 text-blue-700",
		extracting: "bg-orange-100 text-orange-700",
		complete: "bg-green-100 text-green-700",
	};

	const statusLabels = {
		loading: "Loading...",
		classifying: "Classifying...",
		extracting: "Extracting...",
		complete: "Complete",
	};

	return (
		<button
			onClick={onClick}
			className={`w-full p-3 rounded-lg border text-left transition-colors ${
				selected
					? "border-orange-300 bg-orange-50"
					: "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
			}`}
		>
			<div className="flex items-start gap-3">
				{/* PDF icon */}
				<div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
					<svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
						<path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M10.92,12.31C10.68,11.54 10.15,9.08 11.55,9.04C12.95,9 12.03,12.16 12.03,12.16C12.42,13.65 14.05,14.72 14.05,14.72C14.55,14.57 17.4,14.24 17,15.72C16.57,17.2 13.5,15.81 13.5,15.81C11.55,15.95 10.09,16.47 10.09,16.47C8.96,18.58 7.64,19.5 7.1,18.61C6.43,17.5 9.23,16.07 9.23,16.07C10.68,13.72 10.9,12.35 10.92,12.31Z" />
					</svg>
				</div>

				<div className="flex-1 min-w-0">
					<p className="font-medium text-slate-800 truncate" title={filename}>
						{filename}
					</p>
					<div className="flex items-center gap-2 mt-1">
						<span className="text-xs text-slate-500">
							{pageCount} page{pageCount !== 1 ? "s" : ""}
						</span>
						<span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[status]}`}>
							{statusLabels[status]}
						</span>
					</div>
				</div>

				{/* View indicator */}
				<svg
					className="w-5 h-5 text-slate-400 shrink-0"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
				</svg>
			</div>
		</button>
	);
}
