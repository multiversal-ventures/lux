import { QueryClient } from "@tanstack/react-query";

/** Shared React Query client (mount once in App). */
export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5000,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
