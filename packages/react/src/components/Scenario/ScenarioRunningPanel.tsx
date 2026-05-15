import type { CSSProperties, ReactNode } from "react";
import { useMaybeScenarioContext } from "./ScenarioProvider.js";
import {
  useScenarioRunningState,
  type ScenarioRunningState,
} from "./useScenarioRunningState.js";
import styles from "./ScenarioRunningPanel.module.css";

/**
 * Drop-in loader for "this scenario / refinement is running" state.
 *
 * The host plugs this in wherever it would otherwise render the
 * scenario's results (Summary tab, product tab, side panel) and Lux
 * picks the right behaviour:
 *
 *   * **Running** (server status ``running``/``pending`` OR a fresh
 *     ``markJustStarted`` pulse): renders the loader card + meta.
 *   * **Idle** (terminal server status, no pulse): renders ``children``
 *     so the host's results show through.
 *
 * The component reads scenario state from
 * ``useScenarioRunningState(scenarioId)`` which itself draws on
 * ``CaseScenarioProvider`` (server data) + ``scenarioRunsStore`` (the
 * just-started pulse). No host-side polling, no URL plumbing — once
 * the host calls ``markJustStarted`` from the Save & Run handler and
 * mounts ``<ScenarioRunningPanel>`` in its results area, the rest is
 * handled by Lux.
 *
 * Slot model:
 *   - ``children`` = idle content (the actual results).
 *   - ``slots.runningHeadline`` / ``slots.runningSubtitle`` /
 *     ``slots.runningExtra`` allow customising the loader copy without
 *     forking the component. Defaults are tuned for income-qualifying
 *     UX (the only running flow today) but are overridable.
 *   - ``slots.runningRender`` lets a host swap the entire loader if
 *     they need a different shape (e.g. inline pill vs full panel).
 *
 * Style model: a CSS module ships with the component for the common
 * case; ``className`` plus the ``classNames`` hook let hosts restyle
 * incrementally without dropping the bundled animations.
 */
export interface ScenarioRunningPanelClassNames {
  panel?: string;
  spinnerWrap?: string;
  spinner?: string;
  spinnerGlow?: string;
  headline?: string;
  subtitle?: string;
  meta?: string;
  refreshHint?: string;
  refreshDot?: string;
}

export interface ScenarioRunningPanelSlots {
  /** Optional override headline (e.g. "Calculating income"). */
  runningHeadline?: (state: ScenarioRunningState) => ReactNode;
  /** Optional subtitle below the headline. */
  runningSubtitle?: (state: ScenarioRunningState) => ReactNode;
  /** Extra block below the meta line (e.g. a cancel button). */
  runningExtra?: (state: ScenarioRunningState) => ReactNode;
  /** Replace the entire loader render — bypasses all other slots. */
  runningRender?: (state: ScenarioRunningState) => ReactNode;
}

export interface ScenarioRunningPanelProps {
  /**
   * Scenario id to inspect. When omitted, falls back to
   * ``useMaybeScenarioContext().scenarioId`` so the component is plug-
   * and-play inside ``<ScenarioProvider>``.
   */
  scenarioId?: string | null;
  /** Idle content. Rendered when no run is in flight. */
  children?: ReactNode;
  className?: string;
  classNames?: ScenarioRunningPanelClassNames;
  style?: CSSProperties;
  slots?: ScenarioRunningPanelSlots;
}

function defaultHeadline(state: ScenarioRunningState): string {
  if (state.refinementStatus === "pending") return "Queued";
  if (state.refinementStatus === "running") return "Calculating income";
  if (state.scenarioStatus === "pending") return "Queued";
  if (state.scenarioStatus === "running") return "Calculating income";
  // Pulse-only state (server hasn't refetched yet).
  return "Starting up";
}

function defaultSubtitle(state: ScenarioRunningState): string {
  if (state.refinementStatus === "pending" || state.scenarioStatus === "pending") {
    return "Waiting for the income worker to pick up the job.";
  }
  if (state.refinementStatus === "running" || state.scenarioStatus === "running") {
    return "Income rules are running. Bank statement and Non-QM flows can take several minutes — keep this tab open.";
  }
  return "Your run has been scheduled. Status auto-refreshes every few seconds.";
}

/** Inline 12×12 spinner (lucide ``Loader2`` shape) so the component has zero icon-lib peer-dep. */
function DefaultSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function ScenarioRunningPanel({
  scenarioId: scenarioIdProp,
  children,
  className,
  classNames,
  style,
  slots,
}: ScenarioRunningPanelProps) {
  const ctx = useMaybeScenarioContext();
  const scenarioId = scenarioIdProp ?? ctx?.scenarioId ?? null;
  const state = useScenarioRunningState(scenarioId);

  if (!state.isRunning) {
    return <>{children}</>;
  }

  if (slots?.runningRender) return <>{slots.runningRender(state)}</>;

  const headline = slots?.runningHeadline?.(state) ?? defaultHeadline(state);
  const subtitle = slots?.runningSubtitle?.(state) ?? defaultSubtitle(state);
  const extra = slots?.runningExtra?.(state);
  // Meta line ("run #0 — CLI qualify run") was creative-writing exercise,
  // not signal — bootstrap manifests carry refinement_num=0 and a
  // debug placeholder note, neither of which is informative for the
  // operator watching the loader. The loader's job is "something is
  // running"; the refinement's operator-facing identity belongs in the
  // scenario header above the panel, which already shows the LLM-
  // generated scenario name. Hosts can still inject custom meta via
  // ``slots.runningExtra`` if they want a context line.

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={[styles.panel, classNames?.panel, className].filter(Boolean).join(" ")}
      style={style}
    >
      <div className={[styles.spinnerWrap, classNames?.spinnerWrap].filter(Boolean).join(" ")}>
        <DefaultSpinner className={[styles.spinner, classNames?.spinner].filter(Boolean).join(" ")} />
        <div
          aria-hidden="true"
          className={[styles.spinnerGlow, classNames?.spinnerGlow].filter(Boolean).join(" ")}
        />
      </div>
      <h3 className={[styles.headline, classNames?.headline].filter(Boolean).join(" ")}>
        {headline}
      </h3>
      <p className={[styles.subtitle, classNames?.subtitle].filter(Boolean).join(" ")}>
        {subtitle}
      </p>
      {extra}
      <div className={[styles.refreshHint, classNames?.refreshHint].filter(Boolean).join(" ")}>
        <span
          aria-hidden="true"
          className={[styles.refreshDot, classNames?.refreshDot].filter(Boolean).join(" ")}
        />
        Status auto-refreshes every few seconds.
      </div>
    </div>
  );
}
