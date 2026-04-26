import { getDefaultClient, isLuxInitialized } from "@fenero/lux-core";
import { useSession } from "@fenero/lux-react";
import { type CSSProperties, useState } from "react";
import { CodeBlock } from "./CodeBlock.js";
import {
	SNIPPET_API_LAYER,
	SNIPPET_INIT_FIREBASE,
	SNIPPET_INIT_MAIN,
	SNIPPET_INIT_PORTAL_TOKEN,
	SNIPPET_LINKING_PACKAGE_JSON,
	SNIPPET_LINKING_SHELL,
	SNIPPET_SESSION_PROVIDER,
	SNIPPET_USE_AUTH,
	SNIPPET_USE_CASE_EVENTS,
	SNIPPET_USE_SESSION,
} from "./guideSnippets.js";
import { LUX_SAMPLE_PKG_VERSIONS } from "./sdkVersions.js";

/**
 * Interactive integration guide for `@fenero/lux-core` and `@fenero/lux-react`.
 */
export function IntegrationGuide() {
	return (
		<main style={main}>
			<header style={{ marginBottom: "2rem" }}>
				<h1 style={h1}>Lux SDK — integration guide</h1>
				<p style={lead}>
					This sample app is a <strong>developer checklist</strong>: bootstrap the client, wrap
					React, call the API, and link packages into your repo. Each step has copyable code. Your
					product app (e.g. Gunnr) is separate — it does not share this page&apos;s session or
					browser tab.
				</p>
				<p style={meta}>
					Packages in this workspace build:{" "}
					<code>@fenero/lux-core@{LUX_SAMPLE_PKG_VERSIONS.luxCore}</code>,{" "}
					<code>@fenero/lux-react@{LUX_SAMPLE_PKG_VERSIONS.luxReact}</code> (sample app{" "}
					<code>{LUX_SAMPLE_PKG_VERSIONS.sampleDashboard}</code>).
				</p>
			</header>

			<SectionBootstrap />
			<SectionReact />
			<SectionHttp />
			<SectionLinking />
		</main>
	);
}

function SectionBootstrap() {
	const baseUrl = isLuxInitialized() ? getDefaultClient().baseUrl : "";
	const envBase = import.meta.env.VITE_LUX_BASE_URL as string | undefined;

	return (
		<section style={panel} aria-labelledby="sec-bootstrap">
			<h2 id="sec-bootstrap" style={h2}>
				1. Bootstrap — <code>initLux</code>
			</h2>
			<p style={p}>
				Call <code>initLux</code> once before any <code>getDefaultClient()</code> usage (typically
				in <code>main.tsx</code>). Pass <code>baseUrl</code>, an <code>AuthProvider</code> (
				<code>getToken</code>), and optional <code>hooks</code> / <code>veritasVersion</code>.
			</p>

			<h3 style={h3}>Runtime (this tab)</h3>
			<dl style={dl}>
				<dt>SDK initialized</dt>
				<dd>{String(isLuxInitialized())}</dd>
				<dt>
					<code>baseUrl</code> on client
				</dt>
				<dd>
					<code>{baseUrl === "" ? "(empty — relative /api paths)" : baseUrl}</code>
				</dd>
				<dt>
					<code>VITE_LUX_BASE_URL</code>
				</dt>
				<dd>
					<code>{envBase ?? "(unset)"}</code>
				</dd>
				<dt>Auth in this sample</dt>
				<dd>
					Inline object in <code>main.tsx</code> returning a dev token — replace with Firebase or
					portal token in production.
				</dd>
			</dl>

			<h3 style={h3}>
				Minimal <code>main.tsx</code> (same pattern as this app)
			</h3>
			<CodeBlock code={SNIPPET_INIT_MAIN} label="initLux minimal bootstrap" />

			<h3 style={h3}>Dashboard / LO app — Firebase</h3>
			<CodeBlock code={SNIPPET_INIT_FIREBASE} label="initLux with Firebase" />

			<h3 style={h3}>Borrower portal — static portal token</h3>
			<CodeBlock code={SNIPPET_INIT_PORTAL_TOKEN} label="initLux with portal token" />
		</section>
	);
}

function SectionReact() {
	const session = useSession();

	return (
		<section style={panel} aria-labelledby="sec-react">
			<h2 id="sec-react" style={h2}>
				2. React shell — <code>SessionProvider</code> and hooks
			</h2>
			<p style={p}>
				Wrap your tree in <code>SessionProvider</code>. It creates a <code>VeritasSession</code>{" "}
				tied to <code>getDefaultClient()</code>. Pass <code>firebaseAuth</code> only if you use{" "}
				<code>useAuth</code>.
			</p>

			<h3 style={h3}>Provider</h3>
			<CodeBlock code={SNIPPET_SESSION_PROVIDER} label="SessionProvider usage" />

			<h3 style={h3}>
				<code>useSession</code> — live demo
			</h3>
			<p style={p}>
				Tenant and case names below are <strong>local UI state</strong> for this sample, not shared
				with Gunnr or any other app.
			</p>
			<dl style={dl}>
				<dt>Active tenant</dt>
				<dd>{session.tenantName ?? <em>none</em>}</dd>
				<dt>Active case</dt>
				<dd>{session.activeCaseName ?? <em>none</em>}</dd>
			</dl>
			<div style={{ marginTop: ".75rem" }}>
				<button
					type="button"
					style={btn}
					onClick={() => session.setTenant("t-demo", "Demo Tenant")}
				>
					Set demo tenant
				</button>{" "}
				<button type="button" style={btn} onClick={() => session.setActiveCaseName("Demo case #1")}>
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
			</div>

			<h3 style={h3}>
				<code>useSession</code>
			</h3>
			<CodeBlock code={SNIPPET_USE_SESSION} label="useSession snippet" />

			<h3 style={h3}>
				<code>useAuth</code> (needs <code>firebaseAuth</code> on provider)
			</h3>
			<CodeBlock code={SNIPPET_USE_AUTH} label="useAuth snippet" />

			<h3 style={h3}>
				<code>useCase</code> / <code>useEvents</code>
			</h3>
			<CodeBlock code={SNIPPET_USE_CASE_EVENTS} label="useCase and useEvents" />
		</section>
	);
}

function SectionHttp() {
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
		<section style={panel} aria-labelledby="sec-http">
			<h2 id="sec-http" style={h2}>
				3. HTTP — <code>getDefaultClient</code>
			</h2>
			<p style={p}>
				After <code>initLux</code>, route all JSON and uploads through{" "}
				<code>getDefaultClient()</code> so Bearer tokens and optional <code>Veritas-Version</code>{" "}
				stay consistent. For <code>EventSource</code>, use <code>getLuxToken()</code> and append a
				query param (or your backend&apos;s agreed pattern).
			</p>

			<h3 style={h3}>Thin API module (consumer pattern)</h3>
			<CodeBlock code={SNIPPET_API_LAYER} label="API wrapper around VeritasClient" />

			<h3 style={h3}>Live request</h3>
			<p style={p}>
				<code>GET /api/v1/health</code> via Vite proxy → <code>localhost:8000</code> by default. If
				nothing listens there, the error below is expected; the snippet above still applies.
			</p>
			<button type="button" style={btn} onClick={() => void ping()}>
				Ping <code>/api/v1/health</code>
			</button>
			<pre style={resultPre}>{pingResult}</pre>
		</section>
	);
}

function SectionLinking() {
	return (
		<section style={panel} aria-labelledby="sec-linking">
			<h2 id="sec-linking" style={h2}>
				4. Link into your app
			</h2>
			<p style={p}>
				Consumers install published packages from npm, or point <code>file:</code> at tarballs
				produced by <code>pnpm pack</code> from this monorepo (<code>dist-pack/</code>).
			</p>

			<h3 style={h3}>Commands</h3>
			<CodeBlock code={SNIPPET_LINKING_SHELL} label="Build pack and reinstall" />

			<h3 style={h3}>
				<code>package.json</code> (adjust relative path to your layout)
			</h3>
			<CodeBlock code={SNIPPET_LINKING_PACKAGE_JSON} label="file dependencies on packed tarballs" />

			<p style={{ ...p, marginBottom: 0 }}>
				See root <code>README.md</code> → &quot;Linking into a customer repo&quot; for full notes.
				Tarball filenames include the version from each package&apos;s <code>package.json</code>{" "}
				(currently <code>0.0.1</code>).
			</p>
		</section>
	);
}

const main: CSSProperties = {
	maxWidth: 880,
	margin: "2.5rem auto",
	padding: "0 1.5rem 4rem",
	fontFamily: "system-ui, sans-serif",
	color: "#1a1a1a",
};

const h1: CSSProperties = { fontSize: "1.85rem", marginBottom: ".5rem", fontWeight: 650 };
const h2: CSSProperties = { fontSize: "1.15rem", margin: "0 0 .75rem", color: "#222" };
const h3: CSSProperties = { fontSize: "0.95rem", margin: "1.25rem 0 .5rem", color: "#333" };
const lead: CSSProperties = { color: "#444", lineHeight: 1.55, marginTop: ".5rem" };
const meta: CSSProperties = { fontSize: ".9rem", color: "#555", marginTop: "1rem" };
const p: CSSProperties = { marginTop: 0, lineHeight: 1.55, color: "#444" };

const panel: CSSProperties = {
	border: "1px solid #e5e5e5",
	borderRadius: 8,
	padding: "1.25rem 1.35rem",
	marginTop: "1.75rem",
	background: "#fafafa",
};

const dl: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "11rem 1fr",
	rowGap: ".35rem",
	columnGap: ".75rem",
	margin: ".5rem 0 0",
	fontSize: ".9rem",
};

const btn: CSSProperties = {
	padding: ".5rem .85rem",
	border: "1px solid #ccc",
	borderRadius: 6,
	background: "#fff",
	cursor: "pointer",
	fontSize: ".875rem",
};

const resultPre: CSSProperties = {
	marginTop: ".75rem",
	padding: ".75rem",
	background: "#fff",
	border: "1px solid #eee",
	borderRadius: 6,
	overflow: "auto",
	whiteSpace: "pre-wrap",
	fontSize: ".85rem",
	fontFamily: "ui-monospace, Menlo, Monaco, Consolas, monospace",
};
