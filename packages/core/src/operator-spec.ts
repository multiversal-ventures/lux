import type { GenerateSpecResult, OperatorClientError, Result, SpecResponse } from "./operator-types.js";

// Internal helpers for spec generation SSE stream.
type MetaType = { name: string; domain: string; version: string };

interface SpecStreamState {
	yaml: string;
	meta: MetaType | null;
}

/** Process a single decoded SSE data value for the spec-generation stream. */
function processSpecDataLine(
	decoded: string,
	state: SpecStreamState,
	onChunk: (chunk: string) => void,
): { error?: OperatorClientError } {
	if (decoded.includes("\nMETA:")) {
		const idx = decoded.indexOf("\nMETA:");
		const text = decoded.slice(0, idx);
		const metaJson = decoded.slice(idx + 6);
		if (text) {
			state.yaml += text;
			onChunk(text);
		}
		try {
			state.meta = JSON.parse(metaJson) as MetaType;
		} catch {
			/* skip malformed meta */
		}
	} else if (decoded.startsWith("META:")) {
		try {
			state.meta = JSON.parse(decoded.slice(5)) as MetaType;
		} catch {
			/* skip malformed meta */
		}
	} else if (decoded.startsWith('{"error"')) {
		const err = JSON.parse(decoded) as { error: string };
		return { error: { status: 502, message: err.error } };
	} else {
		state.yaml += decoded;
		onChunk(decoded);
	}
	return {};
}

/**
 * Create spec-management methods bound to a shared request context.
 * Returned object is spread into the OperatorClient return value.
 */
export function createSpecMethods(
	base: string,
	authHeaders: (extra?: Record<string, string>) => Record<string, string>,
	request: <T>(res: Response) => Promise<Result<T>>,
) {
	/**
	 * Stream spec YAML token-by-token from POST /api/ai/specs/generate/stream.
	 * Calls onChunk for each raw text delta. Resolves with parsed meta when done.
	 */
	async function generateSpecStream(
		description: string,
		onChunk: (chunk: string) => void,
	): Promise<Result<GenerateSpecResult>> {
		try {
			const res = await fetch(`${base}/api/ai/specs/generate/stream`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ description }),
			});
			if (!res.ok || !res.body) {
				const msg = await res.text().catch(() => res.statusText);
				return { data: null, error: { status: res.status, message: msg } };
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			// Each chunk is JSON-encoded: "data: \"token text\""
			// META chunk: "data: \"\\nMETA:{...}\""
			const state: SpecStreamState = { yaml: "", meta: null };

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const blocks = buffer.split("\n\n");
				buffer = blocks.pop() ?? "";
				for (const block of blocks) {
					for (const line of block.split("\n")) {
						if (!line.startsWith("data: ")) continue;
						const raw = line.slice(6).trim();
						if (!raw) continue;
						let decoded: string;
						try {
							decoded = JSON.parse(raw) as string;
						} catch {
							decoded = raw;
						}
						const { error } = processSpecDataLine(decoded, state, onChunk);
						if (error) return { data: null, error };
					}
				}
			}

			if (!state.meta) return { data: null, error: { status: 500, message: "No metadata in stream" } };
			const { name, domain, version } = state.meta;
			return { data: { yaml: state.yaml, name, domain, version }, error: null };
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function generateSpec(description: string): Promise<Result<GenerateSpecResult>> {
		try {
			const res = await fetch(`${base}/api/ai/specs/generate`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ description }),
			});
			return await request<GenerateSpecResult>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function getSpecDetail(specId: string): Promise<Result<SpecResponse & { yaml_content?: string | null }>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}`, { headers: authHeaders() });
			return await request<SpecResponse & { yaml_content?: string | null }>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function listSpecs(domain?: string): Promise<Result<SpecResponse[]>> {
		try {
			const url = domain
				? `${base}/api/specs?domain=${encodeURIComponent(domain)}`
				: `${base}/api/specs`;
			const res = await fetch(url, { headers: authHeaders() });
			return await request<SpecResponse[]>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function createSpec(payload: {
		name: string;
		domain: string;
		version: string;
		yaml_content: string;
		description?: string;
	}): Promise<Result<{ spec_id: string }>> {
		try {
			const res = await fetch(`${base}/api/specs`, {
				method: "POST",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify(payload),
			});
			return await request<{ spec_id: string }>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function submitSpec(specId: string): Promise<Result<unknown>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}/submit`, {
				method: "PUT",
				headers: authHeaders(),
			});
			return await request<unknown>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	async function approveSpec(specId: string): Promise<Result<unknown>> {
		try {
			const res = await fetch(`${base}/api/specs/${specId}/approve`, {
				method: "PUT",
				headers: authHeaders({ "Content-Type": "application/json" }),
				body: JSON.stringify({ approved_by: "operator" }),
			});
			return await request<unknown>(res);
		} catch {
			return { data: null, error: { status: 0, message: "Network error" } };
		}
	}

	return { generateSpec, generateSpecStream, getSpecDetail, listSpecs, createSpec, submitSpec, approveSpec };
}
