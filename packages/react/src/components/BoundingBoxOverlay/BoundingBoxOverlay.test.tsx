import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BoundingBoxOverlay } from "./BoundingBoxOverlay";

describe("BoundingBoxOverlay", () => {
	it("renders one box per highlight and fires click", () => {
		const onClick = vi.fn();
		const { getAllByRole } = render(
			<BoundingBoxOverlay
				bboxes={[
					{ id: "a", bbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 }, label: "A" },
					{ id: "b", bbox: { x: 0.5, y: 0.6, width: 0.2, height: 0.08 } },
				]}
				imageNaturalSize={{ width: 1000, height: 1400 }}
				onHighlightClick={onClick}
			/>,
		);
		const boxes = getAllByRole("button");
		expect(boxes).toHaveLength(2);
		fireEvent.click(boxes[0]);
		expect(onClick).toHaveBeenCalledWith("a");
	});

	it("applies active class when activeHighlightId matches", () => {
		const { getAllByRole } = render(
			<BoundingBoxOverlay
				bboxes={[{ id: "a", bbox: { x: 0, y: 0, width: 0.1, height: 0.1 } }]}
				imageNaturalSize={{ width: 1, height: 1 }}
				activeHighlightId="a"
			/>,
		);
		const box = getAllByRole("button")[0];
		// CSS-module class name under 'non-scoped' strategy is literal
		expect(box.className).toContain("boxActive");
	});
});
