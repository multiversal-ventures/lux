import {
	APIError,
	type DirectUploadOptions,
	type UploadResponse,
	uploadFilesDirectToGCS,
} from "@fenero/lux-core";
import { useCallback, useState } from "react";
import { useCaseEventStore } from "../stores/caseEventStore";

interface UseApiState<T> {
	data: T | null;
	loading: boolean;
	error: string | null;
}

interface UploadingFile {
	name: string;
	size: number;
	progress: number;
	status: "pending" | "uploading" | "complete" | "error";
}

interface UseUploadState extends UseApiState<UploadResponse> {
	uploadingFiles: UploadingFile[];
	uploadProgress: number;
	phase: "idle" | "preparing" | "uploading" | "starting" | "complete" | "error";
}

export interface UploadOptions {
	loanProductIds?: string[];
	calculationTrack?: string;
}

export function useUpload() {
	const [state, setState] = useState<UseUploadState>({
		data: null,
		loading: false,
		error: null,
		uploadingFiles: [],
		uploadProgress: 0,
		phase: "idle",
	});

	const upload = useCallback(async (files: FileList | File[], options?: UploadOptions) => {
		const fileArray = Array.from(files);
		const uploadingFiles: UploadingFile[] = fileArray.map((f) => ({
			name: f.name,
			size: f.size,
			progress: 0,
			status: "pending",
		}));

		setState({
			data: null,
			loading: true,
			error: null,
			uploadingFiles,
			uploadProgress: 0,
			phase: "preparing",
		});

		try {
			const directOpts: DirectUploadOptions = {
				loanProductIds: options?.loanProductIds,
				calculationTrack: options?.calculationTrack,
				onProgress: (progress) => {
					setState((prev) => {
						let overallProgress = 0;
						if (progress.phase === "preparing") {
							overallProgress = 5;
						} else if (progress.phase === "uploading") {
							const fileProgress = (progress.completedFiles / progress.totalFiles) * 85;
							const currentProgress =
								(progress.currentFileProgress / 100) * (85 / progress.totalFiles);
							overallProgress = 5 + fileProgress + currentProgress;
						} else if (progress.phase === "starting") {
							overallProgress = 95;
						}

						const updatedFiles = prev.uploadingFiles.map((f, idx) => {
							if (idx < progress.completedFiles) {
								return { ...f, progress: 100, status: "complete" as const };
							} else if (f.name === progress.currentFileName) {
								return {
									...f,
									progress: progress.currentFileProgress,
									status: "uploading" as const,
								};
							}
							return f;
						});

						return {
							...prev,
							uploadProgress: Math.round(overallProgress),
							uploadingFiles: updatedFiles,
							phase: progress.phase,
						};
					});
				},
			};

			const result = await uploadFilesDirectToGCS(files, directOpts);

			setState({
				data: result,
				loading: false,
				error: null,
				uploadingFiles: uploadingFiles.map((f) => ({ ...f, progress: 100, status: "complete" })),
				uploadProgress: 100,
				phase: "complete",
			});
			return result;
		} catch (err) {
			if (
				err instanceof APIError &&
				err.status === 400 &&
				err.data &&
				typeof err.data === "object" &&
				"code" in err.data &&
				(err.data as { code?: string }).code === "PAGE_LIMIT_EXCEEDED"
			) {
				const d = err.data as {
					code: string;
					message: string;
					total_pages: number;
					page_limit: number;
				};
				useCaseEventStore.getState().setTenantRestriction({
					code: d.code,
					message: d.message,
					totalPages: d.total_pages,
					pageLimit: d.page_limit,
				});
				setState({
					data: null,
					loading: false,
					error: null,
					uploadingFiles: [],
					uploadProgress: 0,
					phase: "idle",
				});
				return null as unknown as UploadResponse;
			}

			const message = err instanceof Error ? err.message : "Upload failed";
			setState({
				data: null,
				loading: false,
				error: message,
				uploadingFiles: [],
				uploadProgress: 0,
				phase: "error",
			});
			throw err;
		}
	}, []);

	return { ...state, upload };
}
