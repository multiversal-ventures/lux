import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoanStatusBadge } from "./LoanStatusBadge";

const TONES = ["neutral", "info", "warning", "success", "danger"] as const;

describe("LoanStatusBadge", () => {
	it("renders the server's label verbatim", () => {
		render(
			<LoanStatusBadge status={{ key: "under_review", label: "Under review", tone: "info" }} />,
		);
		expect(screen.getByText("Under review")).toBeInTheDocument();
	});

	it.each(TONES)("renders a distinct pill for the %s tone", (tone) => {
		const { container } = render(<LoanStatusBadge status={{ key: "k", label: "L", tone }} />);
		expect(container.firstChild).toHaveClass("rounded-full");
	});

	it("gives each tone its own colour classes", () => {
		const seen = new Set<string>();
		for (const tone of TONES) {
			const { container } = render(<LoanStatusBadge status={{ key: "k", label: "L", tone }} />);
			seen.add((container.firstChild as HTMLElement).className);
		}
		expect(seen.size).toBe(TONES.length);
	});

	it("falls back to the neutral pill for a tone it does not know", () => {
		const { container } = render(
			<LoanStatusBadge status={{ key: "k", label: "L", tone: "chartreuse" }} />,
		);
		const unknown = (container.firstChild as HTMLElement).className;
		const neutral = render(<LoanStatusBadge status={{ key: "k", label: "L", tone: "neutral" }} />);
		expect(unknown).toBe((neutral.container.firstChild as HTMLElement).className);
	});
});
