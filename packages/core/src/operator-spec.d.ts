import type { GenerateSpecResult, Result, SpecResponse } from "./operator-types.js";
/**
 * Create spec-management methods bound to a shared request context.
 * Returned object is spread into the OperatorClient return value.
 */
export declare function createSpecMethods(base: string, authHeaders: (extra?: Record<string, string>) => Record<string, string>, request: <T>(res: Response) => Promise<Result<T>>): {
    generateSpec: (description: string) => Promise<Result<GenerateSpecResult>>;
    generateSpecStream: (description: string, onChunk: (chunk: string) => void) => Promise<Result<GenerateSpecResult>>;
    getSpecDetail: (specId: string) => Promise<Result<SpecResponse & {
        yaml_content?: string | null;
    }>>;
    listSpecs: (domain?: string) => Promise<Result<SpecResponse[]>>;
    createSpec: (payload: {
        name: string;
        domain: string;
        version: string;
        yaml_content: string;
        description?: string;
    }) => Promise<Result<{
        spec_id: string;
    }>>;
    submitSpec: (specId: string) => Promise<Result<unknown>>;
    approveSpec: (specId: string) => Promise<Result<unknown>>;
};
//# sourceMappingURL=operator-spec.d.ts.map