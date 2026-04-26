/** Copy-paste snippets for the integration guide (keep in sync with packages manually). */

export const SNIPPET_INIT_MAIN = `import { initLux } from "@fenero/lux-core";

const sampleAuth = {
  async getToken(): Promise<string | null> {
    return "your-dev-or-test-token";
  },
};

initLux({
  baseUrl: import.meta.env.VITE_LUX_BASE_URL ?? "",
  auth: sampleAuth,
  veritasVersion: undefined, // optional: pin Veritas-Version header
  hooks: {
    onApiError: (info) => console.warn("[app] API error", info),
  },
});`;

export const SNIPPET_INIT_FIREBASE = `import { createFirebaseAuthProvider, initLux } from "@fenero/lux-core";
import { getAuth } from "firebase/auth";

initLux({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
  auth: createFirebaseAuthProvider(() => getAuth()),
  hooks: {
    onApiError: (info) => myTracker.track("api_error", info),
  },
});`;

export const SNIPPET_INIT_PORTAL_TOKEN = `import { initLux, PortalTokenAuthProvider } from "@fenero/lux-core";

initLux({
  baseUrl: "",
  auth: new PortalTokenAuthProvider(portalTokenFromUrl),
});`;

export const SNIPPET_SESSION_PROVIDER = `import { SessionProvider } from "@fenero/lux-react";

function App() {
  return (
    <SessionProvider
      firebaseAuth={() => getAuth()} // optional: only if you use useAuth()
    >
      <Shell />
    </SessionProvider>
  );
}`;

export const SNIPPET_USE_SESSION = `import { useSession } from "@fenero/lux-react";

function Header() {
  const session = useSession();
  return (
    <span>
      {session.tenantName ?? "No tenant"} — {session.activeCaseName ?? "No case"}
    </span>
  );
}`;

export const SNIPPET_USE_AUTH = `import { useAuth } from "@fenero/lux-react";

// Requires <SessionProvider firebaseAuth={() => getAuth()} />
function UserMenu() {
  const { user, loading, signOut, tenantName } = useAuth();
  if (loading) return null;
  if (!user) return <a href="/login">Sign in</a>;
  return (
    <button type="button" onClick={() => void signOut()}>
      Sign out ({tenantName})
    </button>
  );
}`;

export const SNIPPET_USE_CASE_EVENTS = `import { useCase, useEvents } from "@fenero/lux-react";

function CasePanel() {
  const session = useCase(); // alias of useSession today
  const { attachSse, detachSse, getSse } = useEvents();
  // attachSse(caseId) / detachSse() — wire to your case route
  return null;
}`;

export const SNIPPET_API_LAYER = `import {
  APIError,
  getDefaultClient,
  getLuxToken,
} from "@fenero/lux-core";

export { APIError };

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return getDefaultClient().requestJson<T>(path, init);
}

export const api = {
  get: <T>(path: string) =>
    getDefaultClient().requestJson<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    getDefaultClient().requestJson<T>(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
};

export async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  return getDefaultClient().uploadMultipart<T>(path, formData);
}

export async function createEventSource(path: string): Promise<EventSource> {
  const token = await getLuxToken();
  if (!token) throw new Error("Auth required");
  const url = new URL(path, window.location.origin);
  url.searchParams.set("token", token);
  return new EventSource(url.toString());
}`;

export const SNIPPET_LINKING_SHELL = `# From lux repo root — build, pack, reinstall in consumer
pnpm build
pnpm --filter @fenero/lux-core pack --pack-destination ./dist-pack
pnpm --filter @fenero/lux-react pack --pack-destination ./dist-pack

# In consumer (e.g. gunnr/ui)
pnpm install --force
`;

export const SNIPPET_LINKING_PACKAGE_JSON = `{
  "dependencies": {
    "@fenero/lux-core": "file:../../lux/dist-pack/fenero-lux-core-0.0.1.tgz",
    "@fenero/lux-react": "file:../../lux/dist-pack/fenero-lux-react-0.0.1.tgz"
  }
}`;
