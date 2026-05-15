import { SessionProvider } from "@fenero/lux-react";
import { IntegrationGuide } from "./IntegrationGuide.js";

export function App() {
	return (
		<SessionProvider>
			<IntegrationGuide />
		</SessionProvider>
	);
}
