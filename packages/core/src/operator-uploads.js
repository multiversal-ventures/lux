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
const DEFAULT_UPLOAD_CONCURRENCY = 4;
/**
 * Upload a single file to a GCS signed URL with optional progress callback.
 * Uses XMLHttpRequest for upload progress events (fetch lacks upload progress).
 */
export function uploadToSignedUrl(file, urlInfo, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable && onProgress) {
                onProgress(Math.round((e.loaded / e.total) * 100));
            }
        });
        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(urlInfo);
            }
            else {
                reject(new Error(`Upload failed: HTTP ${xhr.status}`));
            }
        });
        xhr.addEventListener("error", () => reject(new Error(`Network error uploading ${file.name}`)));
        xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
        xhr.open("PUT", urlInfo.upload_url);
        xhr.setRequestHeader("Content-Type", urlInfo.content_type);
        xhr.send(file);
    });
}
/**
 * Create upload-orchestration methods bound to a shared request context.
 * Returned object is spread into the OperatorClient return value.
 */
export function createUploadMethods(base, authHeaders, request) {
    async function prepareUpload(files) {
        try {
            const res = await fetch(`${base}/api/cases/prepare-upload`, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ files }),
            });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function startCase(caseId, body) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/start`, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify(body),
            });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function prepareAddFiles(caseId, files) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/files/prepare`, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ files }),
            });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    async function startAddFiles(caseId, files) {
        try {
            const res = await fetch(`${base}/api/cases/${caseId}/files/start`, {
                method: "POST",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ files }),
            });
            return await request(res);
        }
        catch {
            return { data: null, error: { status: 0, message: "Network error" } };
        }
    }
    return { prepareUpload, startCase, prepareAddFiles, startAddFiles };
}
/**
 * Upload files to a new case via signed URLs (bypasses API server for the binary PUT).
 *
 * Steps: prepare → parallel upload to GCS → start case processing.
 */
export async function uploadFilesDirectToGCS(client, files, optionsOrProgress) {
    const options = typeof optionsOrProgress === "function"
        ? { onProgress: optionsOrProgress }
        : (optionsOrProgress ?? {});
    const { onProgress, loanProductIds, calculationTrack } = options;
    const fileArray = Array.from(files);
    onProgress?.({
        phase: "preparing",
        totalFiles: fileArray.length,
        completedFiles: 0,
        currentFileProgress: 0,
    });
    const prepareResponse = await client.requestJson("/api/cases/prepare-upload", {
        method: "POST",
        body: JSON.stringify({ files: fileArray.map((f) => ({ filename: f.name, size: f.size })) }),
    });
    const concurrency = Math.max(1, Math.min(DEFAULT_UPLOAD_CONCURRENCY, fileArray.length));
    const uploadedFiles = [];
    let completedFiles = 0;
    for (let i = 0; i < fileArray.length; i += concurrency) {
        const batch = fileArray.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(async (file, offset) => {
            const index = i + offset;
            const urlInfo = prepareResponse.upload_urls[index];
            const uploaded = await uploadToSignedUrl(file, urlInfo, (fileProgress) => {
                onProgress?.({
                    phase: "uploading",
                    totalFiles: fileArray.length,
                    completedFiles,
                    currentFileProgress: fileProgress,
                    currentFileName: file.name,
                });
            });
            completedFiles += 1;
            return uploaded;
        }));
        uploadedFiles.push(...batchResults);
    }
    onProgress?.({
        phase: "starting",
        totalFiles: fileArray.length,
        completedFiles: fileArray.length,
        currentFileProgress: 100,
    });
    return client.requestJson(`/api/cases/${prepareResponse.case_id}/start`, {
        method: "POST",
        body: JSON.stringify({
            files: uploadedFiles,
            loan_product_ids: loanProductIds,
            calculation_track: calculationTrack,
        }),
    });
}
/**
 * Add files to an existing case via signed URLs.
 *
 * Steps: prepare → parallel upload to GCS → start add-files processing.
 */
export async function addFilesToCase(client, caseId, files, onProgress) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) {
        throw new Error("No files provided");
    }
    onProgress?.({
        phase: "preparing",
        totalFiles: fileArray.length,
        completedFiles: 0,
        currentFileProgress: 0,
    });
    const prepareResponse = await client.requestJson(`/api/cases/${caseId}/files/prepare`, {
        method: "POST",
        body: JSON.stringify({ files: fileArray.map((f) => ({ filename: f.name, size: f.size })) }),
    });
    let completedCount = 0;
    const uploadedFiles = await Promise.all(prepareResponse.upload_urls.map(async (urlInfo, index) => {
        const file = fileArray[index];
        await uploadToSignedUrl(file, urlInfo, (progress) => {
            onProgress?.({
                phase: "uploading",
                totalFiles: fileArray.length,
                completedFiles: completedCount,
                currentFileProgress: progress,
                currentFileName: file.name,
            });
        });
        completedCount += 1;
        return urlInfo;
    }));
    onProgress?.({
        phase: "starting",
        totalFiles: fileArray.length,
        completedFiles: fileArray.length,
        currentFileProgress: 100,
    });
    const startFilesRequest = uploadedFiles.map((urlInfo, index) => ({
        file_id: urlInfo.file_id,
        gcs_path: urlInfo.gcs_path,
        filename: fileArray[index].name,
    }));
    const result = await client.requestJson(`/api/cases/${caseId}/files/start`, {
        method: "POST",
        body: JSON.stringify({ files: startFilesRequest }),
    });
    onProgress?.({
        phase: "complete",
        totalFiles: fileArray.length,
        completedFiles: fileArray.length,
        currentFileProgress: 100,
    });
    return result;
}
/**
 * Upload files via multipart POST (simple path, no signed URLs).
 */
export async function uploadFilesToCase(client, caseId, files) {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) {
        throw new Error("No files provided");
    }
    const formData = new FormData();
    for (const file of fileArray) {
        formData.append("files", file);
    }
    return client.uploadMultipart(`/api/cases/${caseId}/files`, formData);
}
//# sourceMappingURL=operator-uploads.js.map