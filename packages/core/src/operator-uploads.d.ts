/**
 * Upload orchestration for Veritas cases.
 *
 * Two flows:
 *   1. New case:   prepareUpload → uploadToSignedUrl (parallel) → startCase
 *   2. Add files:  prepareAddFiles → uploadToSignedUrl (parallel) → startAddFiles
 *
 * All methods accept an explicit path prefix so callers can target either
 * Veritas-native routes (/api/cases) or Gunnr BFF routes (/api/v1/case).
 */
import type { AddFilesProgress, DirectUploadOptions, DirectUploadProgress, PrepareUploadFile, PrepareUploadResponse, Result, StartAddFilesFileInfo, StartAddFilesResponse, StartCaseRequest, StartCaseResponse, UploadUrlInfo } from "./operator-types.js";
/**
 * Upload a single file to a GCS signed URL with optional progress callback.
 * Uses XMLHttpRequest for upload progress events (fetch lacks upload progress).
 */
export declare function uploadToSignedUrl(file: File, urlInfo: UploadUrlInfo, onProgress?: (progress: number) => void): Promise<UploadUrlInfo>;
/**
 * Create upload-orchestration methods bound to a shared request context.
 * Returned object is spread into the OperatorClient return value.
 */
export declare function createUploadMethods(base: string, authHeaders: (extra?: Record<string, string>) => Record<string, string>, request: <T>(res: Response) => Promise<Result<T>>): {
    prepareUpload: (files: PrepareUploadFile[]) => Promise<Result<PrepareUploadResponse>>;
    startCase: (caseId: string, body: StartCaseRequest) => Promise<Result<StartCaseResponse>>;
    prepareAddFiles: (caseId: string, files: PrepareUploadFile[]) => Promise<Result<PrepareUploadResponse>>;
    startAddFiles: (caseId: string, files: StartAddFilesFileInfo[]) => Promise<Result<StartAddFilesResponse>>;
};
interface RequestJsonFn {
    requestJson<T>(path: string, options?: RequestInit): Promise<T>;
    uploadMultipart<T>(path: string, formData: FormData, options?: RequestInit): Promise<T>;
}
/**
 * Upload files to a new case via signed URLs (bypasses API server for the binary PUT).
 *
 * Steps: prepare → parallel upload to GCS → start case processing.
 */
export declare function uploadFilesDirectToGCS(client: RequestJsonFn, files: FileList | File[], optionsOrProgress?: DirectUploadOptions | ((progress: DirectUploadProgress) => void)): Promise<StartCaseResponse>;
/**
 * Add files to an existing case via signed URLs.
 *
 * Steps: prepare → parallel upload to GCS → start add-files processing.
 */
export declare function addFilesToCase(client: RequestJsonFn, caseId: string, files: FileList | File[], onProgress?: (progress: AddFilesProgress) => void): Promise<StartAddFilesResponse>;
/**
 * Upload files via multipart POST (simple path, no signed URLs).
 */
export declare function uploadFilesToCase(client: RequestJsonFn, caseId: string, files: FileList | File[]): Promise<unknown>;
export {};
//# sourceMappingURL=operator-uploads.d.ts.map