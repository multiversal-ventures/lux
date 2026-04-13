# App Shells Design: Portal, Dashboard, Storybook

## Goal

Create three app shells in `lux/apps/` that prove the monorepo wiring works. Each app is a thin Vite+React shell importing `@fenero/lux-react` and `@fenero/lux-themes`. Firebase auth is adapted from gunnr-app/ui.

## 1. `packages/themes/` — Extract Fenero design tokens

Move gunnr-app's `@theme` block into `default.css`:
- Orange palette (50–900)
- Semantic colors (success, warning, error + light variants)
- CTA colors (cta, cta-hover, action, action-hover)
- Border radii (sm, md, lg, xl)

Add `globals.css` with shared styles:
- Base body styles, font stack
- Scrollbar styling
- Animations (spin, pulse-dot, slide-in, slide-up, fade-in, shimmer)
- Component utility classes (spinner, loading-shimmer, drop-zone, progress-bar, status-dot, toast)

Update package.json exports to include `globals.css`.

## 2. `apps/portal/` — Borrower-facing app

**Stack:** Vite, React 19, Tailwind v4, react-router-dom 7  
**Port:** 3001  
**Auth:** Firebase magic-link (no tenant check — borrowers don't have tenants)

**Files:**
- `vite.config.ts` — Vite + React + Tailwind plugins
- `index.html` — entry HTML
- `src/main.tsx` — Firebase init, waitForAuth, render
- `src/App.tsx` — BrowserRouter with routes
- `src/index.css` — Tailwind import + themes import
- `src/lib/firebase.ts` — waitForAuth, isAuthenticated, getCurrentUser (from gunnr-app)
- `src/hooks/useAuth.ts` — useAuth hook (from gunnr-app, no bypass_tenant_check)
- `src/pages/LoginPage.tsx` — Magic-link login (simplified from gunnr-app, no background images, no Mixpanel)
- `src/pages/HomePage.tsx` — Placeholder borrower dashboard
- `src/components/ProtectedRoute.tsx` — Auth guard (no tenant check)
- `src/components/PublicRoute.tsx` — Public route guard
- `src/vite-env.d.ts` — Vite env types
- `tsconfig.json`
- `package.json`

**Routes:**
- `/` → PublicRoute → redirect to /login or /app
- `/login` → LoginPage
- `/app` → ProtectedRoute → HomePage

## 3. `apps/dashboard/` — LO dashboard

**Stack:** Same as portal  
**Port:** 3002  
**Auth:** Firebase magic-link WITH tenant check (LOs must belong to a tenant)

Same file structure as portal, with these differences:
- `ProtectedRoute.tsx` includes tenant check via `/api/v1/auth/me` (from gunnr-app)
- `HomePage.tsx` shows LO-specific placeholder
- `vite.config.ts` includes proxy for `/api` → `http://localhost:8000`

**Routes:** Same as portal, plus `/complete-registration` placeholder.

## 4. `apps/storybook/` — Component showcase

**Stack:** Storybook 8, Vite builder  
**Port:** 6006

**Files:**
- `.storybook/main.ts` — Storybook config pointing at `../../packages/react/src/**/*.stories.tsx`
- `.storybook/preview.ts` — Import `@fenero/lux-themes/default.css` and `globals.css`
- `src/Welcome.stories.tsx` — Single placeholder story
- `package.json`

## Shared decisions

- **Auth is app-level, not SDK-level.** Each app has its own `useAuth` and Firebase init. The SDK (`@fenero/lux-react`) does not know about Firebase.
- **No Redux, Mixpanel, or analytics.** Those are gunnr-app concerns. Apps start minimal.
- **Same Firebase env vars** as gunnr-app: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.
- **Tailwind v4** with `@tailwindcss/vite` plugin — same as gunnr-app.
- **Biome** for linting/formatting (inherited from workspace root).

## Out of scope

- SDK component implementation (packages remain stubs)
- Landing page design
- Health check context
- Analytics integration
- Background images for login page
