# Case Event Streaming (SSE)

## Goal

Expose Veritas case events to Lux consumers as a typed, reconnecting stream.
Veritas already publishes `GET /cases/{case_id}/events/stream` as Server-Sent
Events (see `packages/core/src/generated.ts:409`). Lux needs a first-class
client so the LO dashboard (and later the portal) can render live case state
without polling.

This is a greenfield addition to `@fenero/lux-core` plus a thin React hook in
`@fenero/lux-react` plus wiring in `apps/dashboard`.

## Non-Goals

- WebSocket transport. Veritas is SSE-only and the auth model is HTTP. No WS.
- A generic pub/sub bus. One stream per case, one consumer pattern.
- Buffering or persistence in Lux. Veritas is the truth. Lux renders.
- Cross-case multiplexing. Open one stream per active case view.

## Background

- Veritas streams JSON events: `data: {"event_id": 1, "event_type": "qualify.spec.evaluated", ...}`.
- The stream terminates when the case reaches a terminal state (completed/failed) or the client disconnects.
- Events are monotonic by `event_id`; clients resume with a cursor.
- Dev proxies already set the SSE-friendly headers (`X-Accel-Buffering: no`, `Cache-Control: no-cache`, `Connection: keep-alive`) in both `apps/portal/vite.config.ts` and `apps/dashboard/vite.config.ts`.

## Design

### 1. `packages/core/src/events.ts` — transport primitive

Mirror the shape of `createPortalClient`: plain function, returns a close
handle, no classes, no inheritance from `EventTarget`.

```typescript
import type { components } from "./generated";

export type CaseEvent = components["schemas"]["CaseEvent"];
// If the schema does not yet export CaseEvent, fall back to:
//   export interface CaseEvent { event_id: number; event_type: string; case_id: string; payload: unknown }
// and file a Veritas ticket to add it.

export interface CaseEventStreamOptions {
  baseUrl?: string;
  /** Resume cursor. Pass the last event_id you saw. */
  lastEventId?: number;
  onEvent: (event: CaseEvent) => void;
  onError?: (err: CaseEventStreamError) => void;
  onOpen?: () => void;
  onClose?: (reason: "terminal" | "client" | "error") => void;
}

export interface CaseEventStreamError {
  code: "network" | "parse" | "server" | "unauthorized";
  message: string;
  status?: number;
}

export interface CaseEventStreamHandle {
  close: () => void;
  /** Most recent event_id received (for resume). */
  readonly lastEventId: number | undefined;
}

export function openCaseEventStream(
  caseId: string,
  opts: CaseEventStreamOptions,
): CaseEventStreamHandle;
```

Implementation notes:

- Use native `EventSource`. Construct URL as `${baseUrl}/api/cases/${caseId}/events/stream` with `?last_event_id=` appended when resuming.
- Parse each `MessageEvent.data` as JSON; on parse failure call `onError({ code: "parse" })` and skip the message without closing.
- Reconnect behavior: `EventSource` auto-reconnects on network blips. We add application-level resume by re-opening with the cached `lastEventId` after 3 consecutive errors — exponential backoff (1s, 2s, 4s, max 30s).
- On HTTP 401 from the initial handshake, surface `code: "unauthorized"` and stop. The dashboard route guard handles re-auth.
- `close()` calls `EventSource.close()` and invokes `onClose("client")` once.
- The stream is considered `terminal` when the server closes cleanly after a terminal event type (list lives in Veritas; Lux treats any server-initiated close as `terminal` rather than error).

### 2. Auth

`EventSource` cannot send custom headers in browsers. Two supported modes:

1. **Same-origin proxy (dev + production behind the same host).** The Vite proxy attaches `Authorization: Bearer …` server-side. No token in the URL. This is the only mode the dashboard uses today.
2. **Signed stream token (cross-origin, future).** Caller passes `streamToken` (short-lived, issued by Veritas via a dedicated mint endpoint) which is appended as `?stream_token=`. Out of scope for this PR; leave a TODO comment and type the option as optional.

Do **not** put long-lived portal tokens in the URL.

### 3. `packages/react/src/useCaseEvents.ts` — React hook

```typescript
export interface UseCaseEventsOptions {
  /** Events buffer size kept in state. Defaults to 100. */
  bufferSize?: number;
}

export interface UseCaseEventsReturn {
  events: CaseEvent[];
  status: "connecting" | "open" | "closed" | "error";
  error: CaseEventStreamError | null;
  /** Force a reconnect (e.g. after route re-entry). */
  reconnect: () => void;
}

export function useCaseEvents(
  caseId: string | null,
  options?: UseCaseEventsOptions,
): UseCaseEventsReturn;
```

Implementation:

- `useEffect` opens the stream when `caseId` is truthy; returns `handle.close` as the cleanup.
- Holds a ring buffer of the last `bufferSize` events (default 100). Consumers who need more should read from Veritas directly.
- Tracks `lastEventId` in a ref so `reconnect` can resume without losing the cursor.
- Exposed via `@fenero/lux-react` package root.

### 4. Dashboard integration

`apps/dashboard` is the first consumer. Add:

- `apps/dashboard/src/hooks/useCaseTimeline.ts` — wraps `useCaseEvents`, maps `event_type` to display-friendly rows (reusing `display_hints` once Veritas exposes them for events).
- A minimal timeline component rendered on the case detail view. Out of scope if the case detail view does not yet exist — in that case, stop at the hook and add a Storybook story driving it with a fake stream.

No portal work in this PR. The borrower-facing SSE story is a separate spec.

## Testing

`packages/core`:

- Unit tests for `openCaseEventStream`:
  - Emits events to `onEvent` in order.
  - Calls `onError({ code: "parse" })` on malformed `data:` and does not close.
  - Resumes with `?last_event_id=` when reopened after error.
  - `close()` is idempotent; `onClose` fires exactly once with `"client"`.
- Use a mock `EventSource` (there's a small `eventsource-mock` pattern — or hand-roll one: a class with `addEventListener`, `close`, and a way to push events from the test).

`packages/react`:

- `useCaseEvents` with Testing Library:
  - Opens on mount, closes on unmount.
  - Status transitions `connecting → open → closed`.
  - `reconnect()` produces a fresh subscription.
  - Buffer trims to `bufferSize`.

No e2e against live Veritas in this PR — mocked streams only.

## File Layout

```
packages/core/src/
  events.ts            # openCaseEventStream + types
  events.test.ts       # unit tests with mock EventSource
  index.ts             # re-export openCaseEventStream and types

packages/react/src/
  useCaseEvents.ts     # React hook
  useCaseEvents.test.tsx
  index.ts             # re-export

apps/dashboard/src/
  hooks/useCaseTimeline.ts  # (optional, see Dashboard integration)
```

## Rollout

1. Land `packages/core` changes behind no flag — additive only.
2. Land `packages/react` hook.
3. Dashboard wires the hook on the case detail view (or Storybook-only if the view isn't ready).
4. `pnpm codegen` after Veritas publishes an updated spec with `CaseEvent` typed, then replace the fallback interface with the generated type.

## Open Questions (resolve before merging)

- Does Veritas currently emit a typed `CaseEvent` in the OpenAPI schema, or is the SSE body untyped (`application/json: unknown`)? The generated spec shows `unknown` — confirm and either generate the type or file a Veritas ticket.
- Is there a terminal-event marker (`event_type: "case.completed"` etc.) the client should use to call `onClose("terminal")` explicitly, or is server-initiated close sufficient?
- Auth: confirm the dashboard's production deployment is same-origin. If not, the signed-stream-token path becomes required, not future work.

## Acceptance Criteria

- [ ] `openCaseEventStream` exists, typed, unit tested, exported from `@fenero/lux-core`.
- [ ] `useCaseEvents` exists, typed, unit tested, exported from `@fenero/lux-react`.
- [ ] Dashboard renders at least one SSE-driven UI surface (real view or Storybook story).
- [ ] No WebSocket code introduced.
- [ ] No business state stored outside the returned handle/hook (Lux stays stateless per CLAUDE.md).
- [ ] `pnpm test` green across the workspace.
- [ ] `pnpm build` green.
