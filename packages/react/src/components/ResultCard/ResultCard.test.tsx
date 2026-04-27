import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ResultCard } from "./ResultCard.js";

describe("ResultCard", () => {
	it("renders QUALIFIES for positive total_monthly", () => {
		const { getByText } = render(
			<ResultCard result={{ product: "fha", specs_run: 2, total_monthly: 5200 }} />,
		);
		expect(getByText("QUALIFIES")).toBeInTheDocument();
	});

	it("uses 'Custom spec' label when product === 'custom'", () => {
		const { getByText } = render(
			<ResultCard result={{ product: "custom", specs_run: 1, total_monthly: 2000 }} />,
		);
		expect(getByText("Custom spec")).toBeInTheDocument();
	});

	it("renders DOES NOT QUALIFY when total_monthly is 0", () => {
		const { getByText } = render(
			<ResultCard result={{ product: "custom", specs_run: 1, total_monthly: 0 }} />,
		);
		expect(getByText("DOES NOT QUALIFY")).toBeInTheDocument();
	});
});
