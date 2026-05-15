import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RefClickPayload } from "../Scenario/ScenarioRefs.js";

/**
 * Shared "currently-focused reference" state. Both producers
 * (e.g. `ScenarioRefs`) and consumers (e.g. `ReferenceViewerPanel`,
 * any host nav handler) read from / write to this context — so a click
 * in the references table lights up a bbox in a viewer mounted anywhere
 * inside the same provider, without prop drilling.
 *
 * The host can also subscribe via `useReferenceFocus()` to drive its
 * own behaviour (URL deep-links, modal open, side panel show), keeping
 * navigation policy out of Lux but allowing the Lux components to be
 * fully composable on their own.
 */
export interface ReferenceFocus {
  payload: RefClickPayload;
  /** Canonical key the user clicked on, e.g. `1040.taxable_interest_amount`. */
  canonicalKey: string;
  /** Monotonically increasing tick — useful for "re-focus on same target" effects. */
  nonce: number;
}

export interface ReferenceFocusContextValue {
  focus: ReferenceFocus | null;
  setFocus: (canonicalKey: string, payload: RefClickPayload) => void;
  clearFocus: () => void;
}

const ReferenceFocusContext = createContext<ReferenceFocusContextValue | null>(
  null,
);

export interface ReferenceFocusProviderProps {
  /**
   * Optional callback fired whenever focus changes. Lets the host wire
   * URL deep-links / analytics / nav without subscribing to context.
   * `null` means focus was cleared.
   */
  onFocusChange?: (focus: ReferenceFocus | null) => void;
  children: ReactNode;
}

export function ReferenceFocusProvider({
  onFocusChange,
  children,
}: ReferenceFocusProviderProps) {
  const [focus, setFocusState] = useState<ReferenceFocus | null>(null);

  const setFocus = useCallback<ReferenceFocusContextValue["setFocus"]>(
    (canonicalKey, payload) => {
      const next: ReferenceFocus = {
        canonicalKey,
        payload,
        nonce: (focus?.nonce ?? 0) + 1,
      };
      setFocusState(next);
      onFocusChange?.(next);
    },
    [focus?.nonce, onFocusChange],
  );

  const clearFocus = useCallback(() => {
    setFocusState(null);
    onFocusChange?.(null);
  }, [onFocusChange]);

  const value = useMemo<ReferenceFocusContextValue>(
    () => ({ focus, setFocus, clearFocus }),
    [focus, setFocus, clearFocus],
  );

  return (
    <ReferenceFocusContext.Provider value={value}>
      {children}
    </ReferenceFocusContext.Provider>
  );
}

/**
 * Read/write the currently-focused reference. Returns `null` when used
 * outside a {@link ReferenceFocusProvider} so consumers can opt-in:
 *
 * ```tsx
 * const ctx = useReferenceFocus();
 * if (ctx) ctx.setFocus(...);
 * ```
 */
export function useReferenceFocus(): ReferenceFocusContextValue | null {
  return useContext(ReferenceFocusContext);
}
