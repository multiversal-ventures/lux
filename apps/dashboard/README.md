# Lux SDK Sample (`@fenero/lux-sample-dashboard`)

A minimal app that demonstrates how to consume `@fenero/lux-core` and
`@fenero/lux-react` from a customer application.

This is **a sample**, not a product. It exists to:

- Show the smallest possible `initLux` setup.
- Show `<SessionProvider>` + `useSession`.
- Show one `getDefaultClient().requestJson(...)` call.

For the real Gunnr product, see the `gunnr` repo.

## Run it

```bash
pnpm install                   # at repo root
pnpm --filter @fenero/lux-core build
pnpm --filter @fenero/lux-react build
pnpm --filter @fenero/lux-sample-dashboard dev
```

Then open `http://localhost:3332`.

By default `/api/*` is proxied to `http://localhost:8000`. Override with
`VITE_LUX_PROXY_TARGET` or set `VITE_LUX_BASE_URL` to use an absolute base URL
without proxying. The "Ping" button hits `GET /api/v1/health`; without a
backend it will fail (and that is fine — the rest of the SDK surface still
works).

## What it does NOT include (on purpose)

- Auth (uses a hardcoded sample token; real apps plug in
  `createFirebaseAuthProvider` or any `AuthProvider` implementation).
- Routing, Redux, React Query, Tailwind, Mixpanel.
- Any product-specific endpoints.
