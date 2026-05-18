import { createContext, useContext, useMemo, type ReactNode, type Context } from "react";
import {
	createOperatorClient,
	type OperatorClient,
} from "@multiversal-ventures/lux-core";
import {
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";

interface OperatorContextValue {
	client: OperatorClient;
	bearerToken: string;
	baseUrl: string;
}

export const OperatorContext = createContext<OperatorContextValue | null>(null);

export interface OperatorProviderProps {
	bearerToken: string;
	baseUrl?: string;
	/** Optional QueryClient. If omitted, one is created with Lux defaults
	 *  (staleTime 30s, retry 1). Pass an existing client to share a cache
	 *  across Lux + app-owned code. */
	queryClient?: QueryClient;
	children: ReactNode;
}

function buildDefaultQueryClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 30_000,
				retry: 1,
				refetchOnWindowFocus: false,
			},
		},
	});
}

export function OperatorProvider({
	bearerToken,
	baseUrl = "",
	queryClient,
	children,
}: OperatorProviderProps) {
	const client = useMemo(
		() => createOperatorClient({ bearerToken, baseUrl }),
		[bearerToken, baseUrl],
	);

	const ownedQueryClient = useMemo(
		() => queryClient ?? buildDefaultQueryClient(),
		[queryClient],
	);

	const value = useMemo(
		() => ({ client, bearerToken, baseUrl }),
		[client, bearerToken, baseUrl],
	);

	if (queryClient) {
		return (
			<OperatorContext.Provider value={value}>
				{children}
			</OperatorContext.Provider>
		);
	}
	return (
		<QueryClientProvider client={ownedQueryClient}>
			<OperatorContext.Provider value={value}>
				{children}
			</OperatorContext.Provider>
		</QueryClientProvider>
	);
}

function useContextOrThrow<T>(ctx: Context<T | null>, name: string): T {
	const v = useContext(ctx);
	if (v === null) {
		throw new Error(`${name} must be used within <OperatorProvider>`);
	}
	return v;
}

export function useOperatorClient(): OperatorClient {
	return useContextOrThrow(OperatorContext, "useOperatorClient").client;
}

/** Returns null instead of throwing when used outside <OperatorProvider>. */
export function useOperatorClientOptional(): OperatorClient | null {
	return useContext(OperatorContext)?.client ?? null;
}

export function useBearerToken(): string {
	return useContextOrThrow(OperatorContext, "useBearerToken").bearerToken;
}

export function useBaseUrl(): string {
	return useContextOrThrow(OperatorContext, "useBaseUrl").baseUrl;
}
