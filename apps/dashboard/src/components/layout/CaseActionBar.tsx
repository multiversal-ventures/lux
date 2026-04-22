import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import type { FileArtifact } from "../../types";
import { resolveApiUrl } from "../../lib/api";

interface CaseActionBarProps {
	caseName?: string | null;
	files?: FileArtifact[];
	onExportExcel?: () => void;
}

export function CaseActionBar({ caseName, files, onExportExcel }: CaseActionBarProps) {
	const navigate = useNavigate();
	const { caseId } = useParams<{ caseId: string }>();
	const { user } = useAuth();
	const [downloading, setDownloading] = useState(false);

	const handleDownloadCaseFiles = useCallback(async () => {
		if (!caseId || !files?.length || downloading) return;
		setDownloading(true);
		try {
			const token = user ? await user.getIdToken() : "";
			const res = await fetch(resolveApiUrl(`/api/v1/case/${caseId}/files/download-zip`), {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!res.ok) throw new Error(`Download failed: ${res.status}`);

			const blob = await res.blob();
			const blobUrl = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = blobUrl;
			link.download = `${caseId.split("-")[0]}_files.zip`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(blobUrl);
		} catch (err) {
			console.error("Case files download failed:", err);
		} finally {
			setDownloading(false);
		}
	}, [caseId, caseName, files, downloading, user]);

	const fileCount = files?.length ?? 0;

	return (
		<div className="flex items-center justify-between px-4 h-11 bg-white border-b border-slate-200">
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={() => navigate("/app")}
					className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					<span>Back</span>
				</button>
				{caseName && (
					<>
						<span className="text-slate-300">|</span>
						<span className="text-sm font-medium text-slate-700">{caseName}</span>
					</>
				)}
			</div>

			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onExportExcel}
					className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors"
				>
					<Download className="w-3.5 h-3.5" />
					Export to Excel
				</button>
				<button
					type="button"
					onClick={handleDownloadCaseFiles}
					disabled={downloading || fileCount === 0}
					className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors disabled:opacity-50"
				>
					{downloading ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
					) : (
						<Download className="w-3.5 h-3.5" />
					)}
					{downloading ? "Downloading..." : `Case Files${fileCount > 0 ? ` (${fileCount})` : ""}`}
				</button>
			</div>
		</div>
	);
}
