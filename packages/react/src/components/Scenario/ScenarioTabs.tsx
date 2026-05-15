import { useScenarioContext } from "./ScenarioProvider.js";
import styles from "./Scenario.module.css";

const SUMMARY_TAB = "summary";

export interface ScenarioTabExtra {
  id: string;
  label: string;
  onClick: () => void;
}

export interface ScenarioTabsProps {
  className?: string;
  /** Additional tabs rendered after the product tabs. */
  extraTabs?: ScenarioTabExtra[];
  /**
   * When the host routes tabs by URL (e.g. React Router), wire navigation here.
   * Receives `"summary"` for the Summary tab or a `product_id` for product tabs.
   * Extra tabs call their own `onClick` only.
   */
  onTabNavigate?: (tabId: string) => void;
}

/**
 * Render Summary + one tab per product the scenario actually ran.
 *
 * Tab visibility is driven entirely by the server-supplied
 * `rendering_hints.product_specs`. The host backend (Veritas) builds
 * that list from the tenant product catalog via `_effective_product_ids`
 * — Non-QM scenarios get Non-QM products, QM scenarios get the QM
 * agencies, and tenant edits to the catalog flow straight through.
 *
 * Deliberately no client-side `approach_type` allow-list: the tenant
 * catalog is the source of truth for "what loan products does this
 * scenario have", so this component shouldn't second-guess it.
 */
export function ScenarioTabs({ className, extraTabs = [], onTabNavigate }: ScenarioTabsProps) {
  const { scenario, activeProductId, setActiveProductId } = useScenarioContext();
  const hints = scenario.rendering_hints;
  const products = hints?.product_specs ?? [];
  const activeProd = activeProductId ?? SUMMARY_TAB;

  return (
    <div className={[styles.tabs, className].filter(Boolean).join(" ")}>
      <button
        className={[styles.tab, activeProd === SUMMARY_TAB ? styles.tabActive : ""].join(" ")}
        onClick={() => {
          setActiveProductId(null);
          onTabNavigate?.(SUMMARY_TAB);
        }}
      >
        Summary
      </button>
      {products.map((p) => (
        <button
          key={p.product_id}
          className={[styles.tab, activeProd === p.product_id ? styles.tabActive : ""].join(" ")}
          onClick={() => {
            setActiveProductId(p.product_id);
            onTabNavigate?.(p.product_id);
          }}
        >
          {p.display_name}
        </button>
      ))}
      {extraTabs.map((t) => (
        <button
          key={t.id}
          className={[styles.tab, activeProd === t.id ? styles.tabActive : ""].join(" ")}
          onClick={() => { setActiveProductId(t.id); t.onClick(); }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
