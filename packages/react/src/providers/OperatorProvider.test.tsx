import { render, renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
	OperatorProvider,
	useOperatorClient,
	useBearerToken,
	useBaseUrl,
} from "./OperatorProvider";

describe("OperatorProvider", () => {
	it("exposes a memoized client via useOperatorClient", () => {
		const { result } = renderHook(() => useOperatorClient(), {
			wrapper: ({ children }) => (
				<OperatorProvider bearerToken="tok">{children}</OperatorProvider>
			),
		});
		expect(typeof result.current.listDocuments).toBe("function");
		expect(typeof result.current.pagePngUrl).toBe("function");
	});

	it("exposes the bearer token unchanged", () => {
		const { result } = renderHook(() => useBearerToken(), {
			wrapper: ({ children }) => (
				<OperatorProvider bearerToken="my-bearer">{children}</OperatorProvider>
			),
		});
		expect(result.current).toBe("my-bearer");
	});

	it("defaults baseUrl to empty string", () => {
		const { result } = renderHook(() => useBaseUrl(), {
			wrapper: ({ children }) => (
				<OperatorProvider bearerToken="t">{children}</OperatorProvider>
			),
		});
		expect(result.current).toBe("");
	});

	it("respects an explicit baseUrl", () => {
		const { result } = renderHook(() => useBaseUrl(), {
			wrapper: ({ children }) => (
				<OperatorProvider bearerToken="t" baseUrl="https://api.example.com">
					{children}
				</OperatorProvider>
			),
		});
		expect(result.current).toBe("https://api.example.com");
	});

	it("throws when hooks are used outside the provider", () => {
		expect(() =>
			renderHook(() => useOperatorClient()),
		).toThrow(/useOperatorClient must be used within <OperatorProvider>/);
	});

	it("renders children without error", () => {
		const { getByText } = render(
			<OperatorProvider bearerToken="t">
				<div>hello</div>
			</OperatorProvider>,
		);
		expect(getByText("hello")).toBeInTheDocument();
	});
});
