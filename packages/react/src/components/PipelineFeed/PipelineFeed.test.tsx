import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PipelineFeed } from "./PipelineFeed";

describe("PipelineFeed", () => {
	it("renders events with the formatted action", () => {
		const { getByText } = render(
			<PipelineFeed events={[
				{ event_id: 1, event_type: "extraction.completed", event_data: null, created_at: null },
			]} />
		);
		expect(getByText("completed")).toBeInTheDocument();
	});

	it("shows 'Connecting…' when connecting is true", () => {
		const { getAllByText } = render(<PipelineFeed events={[]} connecting />);
		expect(getAllByText(/Connecting/).length).toBeGreaterThan(0);
	});
});
