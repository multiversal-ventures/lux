import { getDefaultClient, isLuxInitialized } from "@fenero/lux-core";
import { SessionProvider, useSession } from "@fenero/lux-react";
import { useState } from "react";

/**
 * Minimal SDK sample.
 *
 * Demonstrates:
 *  - `initLux` (see `main.tsx`)
 *  - `SessionProvider` + `useSession`
 *  - `getDefaultClient().requestJson(...)` against a Veritas-style endpoint
 *
 * Set `VITE_LUX_BASE_URL` (or use the `/api` Vite proxy) to point at a real
 * Veritas backend. Without one, the "ping" button will fail — that's fine,
 * the sample still illustrates the SDK surface.
 */
export function App() {
	return (
		<SessionProvider>
			<Shell />
		</SessionProvider>
	);
}

function Shell() {
	const session = useSession();
	const [pingResult, setPingResult] = useState<string>("(not yet pinged)");

	async function ping() {
		try {
			const data = await getDefaultClient().requestJson<unknown>("/api/v1/health");
			setPingResult(`OK: ${JSON.stringify(data)}`);
		} catch (err) {
			setPingResult(`ERROR: ${(err as Error).message}`);
		}
	}

	return (
		<main
			style={{
				maxWidth: 720,
				margin: "4rem auto",
				padding: "0 1.5rem",
				fontFamily: "system-ui, sans-serif",
				color: "#1a1a1a",
			}}
		>
			<h1 style={{ fontSize: "1.75rem", marginBottom: ".25rem" }}>Lux SDK Sample</h1>
			<p style={{ color: "#555", marginTop: 0 }}>
				A minimal app demonstrating <code>@fenero/lux-core</code> and{" "}
				<code>@fenero/lux-react</code>.
			</p>

			<section style={panel}>
				<h2 style={h2}>Runtime</h2>
				<dl style={dl}>
					<dt>SDK initialized</dt>
					<dd>{String(isLuxInitialized())}</dd>
					<dt>Active tenant</dt>
					<dd>{session.tenantName ?? <em>none</em>}</dd>
					<dt>Active case</dt>
					<dd>{session.activeCaseName ?? <em>none</em>}</dd>
				</dl>
			</section>

			<section style={panel}>
				<h2 style={h2}>HTTP ping</h2>
				<p style={{ marginTop: 0 }}>
					Calls <code>getDefaultClient().requestJson("/api/v1/health")</code>.
				</p>
				<button type="button" style={btn} onClick={ping}>
					Ping
				</button>
				<pre style={pre}>{pingResult}</pre>
			</section>

			<section style={panel}>
				<h2 style={h2}>Session controls</h2>
				<button
					type="button"
					style={btn}
					onClick={() => session.setTenant("t-demo", "Demo Tenant")}
				>
					Set demo tenant
				</button>{" "}
				<button
					type="button"
					style={btn}
					onClick={() => session.setActiveCaseName("Demo case #1")}
				>
					Set demo case
				</button>{" "}
				<button
					type="button"
					style={btn}
					onClick={() => {
						session.setTenant(null, null);
						session.setActiveCaseName(null);
					}}
				>
					Reset
				</button>
			</section>
		</main>
	);
}

const panel: React.CSSProperties = {
	border: "1px solid #e5e5e5",
	borderRadius: 8,
	padding: "1rem 1.25rem",
	marginTop: "1.5rem",
	background: "#fafafa",
};
const h2: React.CSSProperties = { fontSize: "1rem", margin: "0 0 .75rem", color: "#333" };
const dl: React.CSSProperties = {
	display: "grid",
	gridTemplateColumns: "10rem 1fr",
	rowGap: ".25rem",
	margin: 0,
};
const btn: React.CSSProperties = {
	padding: ".5rem .9rem",
	border: "1px solid #ccc",
	borderRadius: 6,
	background: "#fff",
	cursor: "pointer",
};
const pre: React.CSSProperties = {
	marginTop: ".75rem",
	padding: ".75rem",
	background: "#fff",
	border: "1px solid #eee",
	borderRadius: 6,
	overflow: "auto",
	whiteSpace: "pre-wrap",
};
