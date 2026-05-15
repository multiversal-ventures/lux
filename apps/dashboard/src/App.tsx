import { SessionProvider } from "@fenero-ai/lux-react";
import { IntegrationGuide } from "./IntegrationGuide.js";

export function App() {
	return (
		<SessionProvider>
			<IntegrationGuide />
		</SessionProvider>
	);
}
