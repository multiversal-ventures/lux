# App Shells Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three app shells (portal, dashboard, storybook) that prove the Lux monorepo wiring works, with Firebase auth and Fenero design tokens.

**Architecture:** Each app is a thin Vite+React shell importing `@fenero/lux-react` and `@fenero/lux-themes`. Auth is app-level (Firebase magic-link). Themes package owns design tokens and global CSS. Storybook showcases SDK components.

**Tech Stack:** Vite 7, React 19, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom 7, Firebase 12, Storybook 8

---

## File Map

```
packages/themes/
  default.css          — Fenero design tokens (@theme block)
  globals.css          — NEW: shared animations, scrollbar, utility classes
  dark.css             — existing (empty for now)
  package.json         — update exports to include globals.css

apps/portal/
  package.json
  vite.config.ts
  index.html
  tsconfig.json
  src/
    main.tsx           — Firebase init + render
    App.tsx            — Router + routes
    index.css          — Tailwind + theme imports
    vite-env.d.ts      — Vite client types
    lib/firebase.ts    — waitForAuth, isAuthenticated, getCurrentUser
    hooks/useAuth.ts   — useAuth hook
    pages/LoginPage.tsx    — Magic-link login (simplified)
    pages/HomePage.tsx     — Placeholder borrower dashboard
    components/ProtectedRoute.tsx  — Auth guard (no tenant)
    components/PublicRoute.tsx     — Public route guard

apps/dashboard/
  package.json
  vite.config.ts       — includes /api proxy
  index.html
  tsconfig.json
  src/
    main.tsx
    App.tsx
    index.css
    vite-env.d.ts
    lib/firebase.ts
    hooks/useAuth.ts
    pages/LoginPage.tsx
    pages/HomePage.tsx
    components/ProtectedRoute.tsx  — Auth guard WITH tenant check
    components/PublicRoute.tsx

apps/storybook/
  package.json
  tsconfig.json
  .storybook/main.ts
  .storybook/preview.ts
  .storybook/preview.css    — Tailwind + theme imports for Storybook
  src/Welcome.stories.tsx
```

---

### Task 1: Update `packages/themes/` with Fenero design tokens

**Files:**
- Modify: `packages/themes/default.css`
- Create: `packages/themes/globals.css`
- Modify: `packages/themes/package.json`

- [ ] **Step 1: Write design tokens into `default.css`**

Replace the empty `:root {}` with the Fenero `@theme` block from gunnr-app:

```css
@theme {
  /* Fenero Orange Palette */
  --color-orange-50: #fff7ed;
  --color-orange-100: #ffedd5;
  --color-orange-200: #fed7aa;
  --color-orange-300: #fdba74;
  --color-orange-400: #fb923c;
  --color-orange-500: #f97316;
  --color-orange-600: #ea580c;
  --color-orange-700: #c2410c;
  --color-orange-800: #9a3412;
  --color-orange-900: #7c2d12;

  /* Semantic Colors */
  --color-success: #10b981;
  --color-success-light: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  --color-error: #ef4444;
  --color-error-light: #fee2e2;

  /* CTA Colors */
  --color-cta: #EC4D22;
  --color-cta-hover: #D4441F;

  /* Secondary Action Colors */
  --color-action: #253C80;
  --color-action-hover: #1E3066;

  /* Border Radius */
  --radius-sm: 8px;
  --radius: 12px;
  --radius-md: 16px;
  --radius-lg: 20px;
  --radius-xl: 24px;
}
```

- [ ] **Step 2: Create `globals.css`**

Create `packages/themes/globals.css`. Read `../gunnr-app/ui/src/index.css` and copy everything AFTER the `@theme { ... }` block (starting from the scrollbar styling section through the end of file). This includes:
- Global scrollbar styling (lines 41–119)
- Base body styles (lines 121–131)
- Animation keyframes and classes (lines 133–226)
- Component utility classes: spinner, loading-shimmer, drop-zone, event-item, source-badge, results-tab, fact-row, agent-avatar, progress-bar, status-dot, toast, stepper animations (lines 228–486)

The agent MUST read the file and copy the content — do not abbreviate or summarize.

- [ ] **Step 3: Update `package.json` exports**

Add `globals.css` to the exports map:

```json
{
  "name": "@fenero/lux-themes",
  "version": "0.0.1",
  "type": "module",
  "exports": {
    "./default.css": "./default.css",
    "./globals.css": "./globals.css",
    "./dark.css": "./dark.css"
  },
  "scripts": {
    "build": "echo 'no build step for themes'",
    "typecheck": "echo 'no typecheck for themes'"
  }
}
```

- [ ] **Step 4: Verify build**

Run: `pnpm build --filter @fenero/lux-themes`
Expected: success (echo, no real build)

- [ ] **Step 5: Commit**

```bash
git add packages/themes/
git commit -m "feat(themes): add Fenero design tokens and global styles"
```

---

### Task 2: Scaffold `apps/portal/` — package.json, Vite, TypeScript, HTML

**Files:**
- Modify: `apps/portal/package.json`
- Create: `apps/portal/vite.config.ts`
- Create: `apps/portal/index.html`
- Create: `apps/portal/tsconfig.json`
- Create: `apps/portal/src/vite-env.d.ts`
- Create: `apps/portal/src/index.css`

- [ ] **Step 1: Update `apps/portal/package.json`**

```json
{
  "name": "@fenero/portal",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fenero/lux-react": "workspace:*",
    "@fenero/lux-themes": "workspace:*",
    "firebase": "^12.7.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.11.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.7.0",
    "vite": "^7.2.0"
  }
}
```

- [ ] **Step 2: Create `apps/portal/vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 3001,
	},
});
```

- [ ] **Step 3: Create `apps/portal/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fenero — Borrower Portal</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create `apps/portal/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "types": ["vite/client"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create `apps/portal/src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 6: Create `apps/portal/src/index.css`**

```css
@import "tailwindcss";
@import "@fenero/lux-themes/default.css";
@import "@fenero/lux-themes/globals.css";
```

- [ ] **Step 7: Commit**

```bash
git add apps/portal/
git commit -m "feat(portal): scaffold Vite + React + Tailwind config"
```

---

### Task 3: Portal Firebase auth + useAuth hook

**Files:**
- Create: `apps/portal/src/lib/firebase.ts`
- Create: `apps/portal/src/hooks/useAuth.ts`

- [ ] **Step 1: Create `apps/portal/src/lib/firebase.ts`**

```typescript
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";

let authReady = false;
let currentUser: User | null = null;

export function waitForAuth(): Promise<User | null> {
	if (authReady) {
		return Promise.resolve(currentUser);
	}
	return new Promise((resolve) => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, (user) => {
			authReady = true;
			currentUser = user;
			unsubscribe();
			resolve(user);
		});
	});
}

export function isAuthenticated(): boolean {
	return authReady && currentUser !== null;
}

export function getCurrentUser(): User | null {
	return currentUser;
}
```

- [ ] **Step 2: Create `apps/portal/src/hooks/useAuth.ts`**

Copy from `../gunnr-app/ui/src/hooks/useAuth.ts`. Remove the `bypass_tenant_check` localStorage line from `signOut`:

```typescript
import { useState, useEffect } from "react";
import {
	getAuth,
	onAuthStateChanged,
	signOut as firebaseSignOut,
} from "firebase/auth";
import type { User } from "firebase/auth";

interface UseAuthReturn {
	user: User | null;
	loading: boolean;
	signOut: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const auth = getAuth();
		const unsubscribe = onAuthStateChanged(auth, (u) => {
			setUser(u);
			setLoading(false);
		});
		return () => unsubscribe();
	}, []);

	const signOut = async () => {
		const auth = getAuth();
		await firebaseSignOut(auth);
	};

	return { user, loading, signOut };
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/portal/src/lib/ apps/portal/src/hooks/
git commit -m "feat(portal): add Firebase auth helpers and useAuth hook"
```

---

### Task 4: Portal route guards, pages, App, main

**Files:**
- Create: `apps/portal/src/components/ProtectedRoute.tsx`
- Create: `apps/portal/src/components/PublicRoute.tsx`
- Create: `apps/portal/src/pages/LoginPage.tsx`
- Create: `apps/portal/src/pages/HomePage.tsx`
- Create: `apps/portal/src/App.tsx`
- Create: `apps/portal/src/main.tsx`

- [ ] **Step 1: Create `ProtectedRoute.tsx`**

Simplified from gunnr-app — no tenant check, no Redux:

```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
	children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="spinner" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	return <>{children}</>;
}
```

- [ ] **Step 2: Create `PublicRoute.tsx`**

Same pattern as gunnr-app:

```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface PublicRouteProps {
	children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
	const { user, loading } = useAuth();

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="spinner" />
			</div>
		);
	}

	if (user) {
		return <Navigate to="/app" replace />;
	}

	return <>{children}</>;
}
```

- [ ] **Step 3: Create `LoginPage.tsx`**

Simplified magic-link login. No background images, no Mixpanel, no terms checkbox:

```tsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import {
	getAuth,
	sendSignInLinkToEmail,
	isSignInWithEmailLink,
	signInWithEmailLink,
} from "firebase/auth";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
	const { user, loading } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [emailSent, setEmailSent] = useState(false);
	const [error, setError] = useState("");
	const [processingMagicLink, setProcessingMagicLink] = useState(() => {
		try {
			return isSignInWithEmailLink(getAuth(), window.location.href);
		} catch {
			return false;
		}
	});

	useEffect(() => {
		if (user && !loading) {
			const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/app";
			navigate(from, { replace: true });
		}
	}, [user, loading, navigate, location]);

	useEffect(() => {
		const checkMagicLink = async () => {
			const auth = getAuth();
			if (!isSignInWithEmailLink(auth, window.location.href)) return;

			setProcessingMagicLink(true);
			const savedEmail = localStorage.getItem("emailForSignIn");
			if (!savedEmail) {
				setProcessingMagicLink(false);
				return;
			}

			try {
				await signInWithEmailLink(auth, savedEmail, window.location.href);
				localStorage.removeItem("emailForSignIn");
				window.history.replaceState({}, document.title, "/login");
			} catch {
				setError("Invalid or expired magic link. Please try again.");
				setProcessingMagicLink(false);
			}
		};

		if (!loading && !user) {
			checkMagicLink();
		}
	}, [loading, user]);

	if (loading || processingMagicLink) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="text-center">
					<div className="spinner mx-auto mb-4" />
					<p className="text-slate-600">
						{processingMagicLink ? "Signing you in..." : "Loading..."}
					</p>
				</div>
			</div>
		);
	}

	if (user) {
		const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/app";
		return <Navigate to={from} replace />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!email) {
			setError("Please enter your email address");
			return;
		}

		setIsLoading(true);
		try {
			const auth = getAuth();
			await sendSignInLinkToEmail(auth, email, {
				url: window.location.origin + "/login",
				handleCodeInApp: true,
			});
			localStorage.setItem("emailForSignIn", email);
			setEmailSent(true);
		} catch {
			setError("Failed to send magic link. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	if (emailSent) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="max-w-md w-full p-8">
					<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm text-center">
						<h2 className="text-2xl font-bold text-slate-900 mb-4">Check your email!</h2>
						<p className="text-slate-600 mb-8">
							We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
						</p>
						<button
							onClick={() => setEmailSent(false)}
							className="text-cta hover:text-cta-hover font-medium cursor-pointer"
						>
							Try again
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50">
			<div className="max-w-md w-full p-8">
				<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
					<h1 className="text-2xl font-bold text-slate-900 mb-2">Borrower Portal</h1>
					<p className="text-slate-600 mb-8">Sign in to access your loan application.</p>

					{error && (
						<div className="mb-4 p-3 bg-error-light border border-error text-red-700 rounded-lg text-sm">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit}>
						<label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none mb-6"
							placeholder="you@example.com"
							disabled={isLoading}
						/>
						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-cta hover:bg-cta-hover text-white font-semibold py-3 px-4 rounded-full transition-colors cursor-pointer disabled:opacity-50"
						>
							{isLoading ? "Sending..." : "Sign In with Magic Link"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
```

- [ ] **Step 4: Create `HomePage.tsx`**

```tsx
import { useAuth } from "../hooks/useAuth";

export function HomePage() {
	const { user, signOut } = useAuth();

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
				<h1 className="text-lg font-bold text-slate-900">Borrower Portal</h1>
				<div className="flex items-center gap-4">
					<span className="text-sm text-slate-600">{user?.email}</span>
					<button
						onClick={signOut}
						className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
					>
						Sign out
					</button>
				</div>
			</header>
			<main className="max-w-4xl mx-auto p-8">
				<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">Welcome</h2>
					<p className="text-slate-600">
						Your loan application dashboard will appear here once SDK components are built.
					</p>
				</div>
			</main>
		</div>
	);
}
```

- [ ] **Step 5: Create `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/app" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
			</Routes>
		</BrowserRouter>
	);
}
```

- [ ] **Step 6: Create `main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { initializeApp } from "firebase/app";
import { waitForAuth } from "./lib/firebase";

initializeApp({
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

waitForAuth().then(() => {
	createRoot(document.getElementById("root")!).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
```

- [ ] **Step 7: Install deps and verify build**

Run: `pnpm install && pnpm build --filter @fenero/portal`
Expected: successful build

- [ ] **Step 8: Commit**

```bash
git add apps/portal/
git commit -m "feat(portal): add Firebase auth, login page, and route guards"
```

---

### Task 5: Scaffold `apps/dashboard/` — same as portal with tenant check

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/vite.config.ts` (with /api proxy)
- Create: `apps/dashboard/index.html`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/src/vite-env.d.ts`
- Create: `apps/dashboard/src/index.css`
- Create: `apps/dashboard/src/lib/firebase.ts`
- Create: `apps/dashboard/src/hooks/useAuth.ts`
- Create: `apps/dashboard/src/components/ProtectedRoute.tsx` (WITH tenant check)
- Create: `apps/dashboard/src/components/PublicRoute.tsx`
- Create: `apps/dashboard/src/pages/LoginPage.tsx`
- Create: `apps/dashboard/src/pages/HomePage.tsx`
- Create: `apps/dashboard/src/App.tsx`
- Create: `apps/dashboard/src/main.tsx`

- [ ] **Step 1: Create `apps/dashboard/package.json`**

Same as portal but named `@fenero/dashboard`.

```json
{
  "name": "@fenero/dashboard",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@fenero/lux-react": "workspace:*",
    "@fenero/lux-themes": "workspace:*",
    "firebase": "^12.7.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.11.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.7.0",
    "vite": "^7.2.0"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts` with API proxy**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		port: 3002,
		proxy: {
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
				configure: (proxy) => {
					proxy.on("proxyRes", (proxyRes, req) => {
						if (req.url?.includes("/stream")) {
							proxyRes.headers["X-Accel-Buffering"] = "no";
							proxyRes.headers["Cache-Control"] = "no-cache";
							proxyRes.headers["Connection"] = "keep-alive";
						}
					});
				},
			},
		},
	},
});
```

- [ ] **Step 3: Create index.html, tsconfig.json, vite-env.d.ts, index.css**

Same as portal. Change `<title>` to `Fenero — Dashboard`.

- [ ] **Step 4: Copy firebase.ts, useAuth.ts, PublicRoute.tsx from portal**

Identical files.

- [ ] **Step 5: Create dashboard `ProtectedRoute.tsx` WITH tenant check**

Adapted from gunnr-app. Uses fetch to `/api/v1/auth/me` to verify tenant membership. No Redux — uses local state:

```tsx
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface ProtectedRouteProps {
	children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
	const { user, loading } = useAuth();
	const [hasTenant, setHasTenant] = useState<boolean | null>(null);
	const [checkingTenant, setCheckingTenant] = useState(true);

	useEffect(() => {
		async function checkTenant() {
			if (!user) {
				setCheckingTenant(false);
				return;
			}
			try {
				const token = await user.getIdToken();
				const res = await fetch("/api/v1/auth/me", {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) {
					const data = await res.json();
					setHasTenant(data.has_tenant === true);
				} else {
					setHasTenant(false);
				}
			} catch {
				setHasTenant(false);
			} finally {
				setCheckingTenant(false);
			}
		}

		if (!loading) {
			checkTenant();
		}
	}, [user, loading]);

	if (loading || checkingTenant) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="spinner" />
			</div>
		);
	}

	if (!user) {
		return <Navigate to="/login" replace />;
	}

	if (hasTenant === false) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="bg-white p-8 rounded-xl border border-slate-200 max-w-md text-center">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">No Organization</h2>
					<p className="text-slate-600">
						Your account is not associated with an organization. Contact your administrator.
					</p>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
```

- [ ] **Step 6: Create dashboard `LoginPage.tsx`**

Copy the portal `LoginPage.tsx` verbatim, then change two strings:
- `"Borrower Portal"` → `"Dashboard"`
- `"Sign in to access your loan application."` → `"Sign in to access loan officer tools."`

- [ ] **Step 7: Create dashboard `HomePage.tsx`**

```tsx
import { useAuth } from "../hooks/useAuth";

export function HomePage() {
	const { user, signOut } = useAuth();

	return (
		<div className="min-h-screen bg-slate-50">
			<header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
				<h1 className="text-lg font-bold text-slate-900">LO Dashboard</h1>
				<div className="flex items-center gap-4">
					<span className="text-sm text-slate-600">{user?.email}</span>
					<button
						onClick={signOut}
						className="text-sm text-slate-500 hover:text-slate-700 cursor-pointer"
					>
						Sign out
					</button>
				</div>
			</header>
			<main className="max-w-4xl mx-auto p-8">
				<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
					<h2 className="text-xl font-semibold text-slate-900 mb-2">Dashboard</h2>
					<p className="text-slate-600">
						Loan officer tools will appear here once SDK components are built.
					</p>
				</div>
			</main>
		</div>
	);
}
```

- [ ] **Step 8: Create dashboard `App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";

export function App() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<PublicRoute><LoginPage /></PublicRoute>} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/app" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
			</Routes>
		</BrowserRouter>
	);
}
```

- [ ] **Step 9: Create dashboard `main.tsx`**

Identical to portal `main.tsx` (same Firebase init pattern).

- [ ] **Step 10: Install deps and verify build**

Run: `pnpm install && pnpm build --filter @fenero/dashboard`
Expected: successful build

- [ ] **Step 11: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add LO dashboard with tenant-checked auth"
```

---

### Task 6: Scaffold `apps/storybook/`

**Files:**
- Create: `apps/storybook/package.json`
- Create: `apps/storybook/tsconfig.json`
- Create: `apps/storybook/.storybook/main.ts`
- Create: `apps/storybook/.storybook/preview.ts`
- Create: `apps/storybook/.storybook/preview.css`
- Create: `apps/storybook/src/Welcome.stories.tsx`

- [ ] **Step 1: Create `apps/storybook/package.json`**

```json
{
  "name": "@fenero/storybook",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "storybook dev -p 6006",
    "build": "storybook build",
    "typecheck": "echo 'storybook typecheck placeholder'"
  },
  "dependencies": {
    "@fenero/lux-react": "workspace:*",
    "@fenero/lux-themes": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@storybook/addon-essentials": "^8.0.0",
    "@storybook/react": "^8.0.0",
    "@storybook/react-vite": "^8.0.0",
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "storybook": "^8.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.7.0",
    "vite": "^7.2.0"
  }
}
```

- [ ] **Step 2: Create `.storybook/main.ts`**

```typescript
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
	stories: [
		"../src/**/*.stories.@(ts|tsx)",
		"../../../packages/react/src/**/*.stories.@(ts|tsx)",
	],
	addons: ["@storybook/addon-essentials"],
	framework: {
		name: "@storybook/react-vite",
		options: {},
	},
};

export default config;
```

- [ ] **Step 3: Create `.storybook/preview.css`**

Tailwind must be imported via CSS, not JS:

```css
@import "tailwindcss";
@import "@fenero/lux-themes/default.css";
@import "@fenero/lux-themes/globals.css";
```

- [ ] **Step 4: Create `.storybook/preview.ts`**

```typescript
import "./preview.css";

import type { Preview } from "@storybook/react";

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},
	},
};

export default preview;
```

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src", ".storybook"]
}
```

- [ ] **Step 6: Create `src/Welcome.stories.tsx`**

```tsx
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
```

- [ ] **Step 7: Install deps and verify storybook builds**

Run: `pnpm install && pnpm build --filter @fenero/storybook`
Expected: successful build

- [ ] **Step 8: Commit**

```bash
git add apps/storybook/
git commit -m "feat(storybook): add Storybook 8 with Vite builder"
```

---

### Task 7: Verify full monorepo build

- [ ] **Step 1: Run `pnpm install`**

Expected: all workspace deps resolve

- [ ] **Step 2: Run `pnpm build`**

Expected: all packages and apps build successfully via Turborepo

- [ ] **Step 3: Run `pnpm dev --filter @fenero/portal` briefly to verify Vite starts**

Expected: Vite dev server starts on port 3001

- [ ] **Step 4: Commit any lockfile changes**

```bash
git add pnpm-lock.yaml
git commit -m "chore: update lockfile for new apps"
```
