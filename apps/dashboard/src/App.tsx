import { SessionProvider } from "@multiversal-ventures/lux-react";
import { IntegrationGuide } from "./IntegrationGuide.js";

export function App() {
	return (
		<SessionProvider>
			<IntegrationGuide />
		</SessionProvider>
	);
}
