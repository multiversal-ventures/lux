import type { Meta, StoryObj } from "@storybook/react";

function Welcome() {
	return (
		<div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
			<h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
				Lux Component Library
			</h1>
			<p style={{ color: "#64748b" }}>
				Components will appear here as they are built in{" "}
				<code>@fenero/lux-react</code>.
			</p>
		</div>
	);
}

const meta: Meta<typeof Welcome> = {
	title: "Welcome",
	component: Welcome,
};

export default meta;
type Story = StoryObj<typeof Welcome>;

export const Default: Story = {};
