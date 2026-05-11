import { useScenarioContext } from "./ScenarioProvider.js";
import styles from "./Scenario.module.css";

const SUMMARY_TAB = "summary";
const SHOW_PRODUCT_TABS_APPROACHES = new Set(["qm_standard"]);

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

export function ScenarioTabs({ className, extraTabs = [], onTabNavigate }: ScenarioTabsProps) {
  const { scenario, activeProductId, setActiveProductId } = useScenarioContext();
  const hints = scenario.rendering_hints;
  const approachType = hints?.approach_type ?? "qm_standard";
  const showProductTabs = SHOW_PRODUCT_TABS_APPROACHES.has(approachType);
  const products = showProductTabs ? (hints?.product_specs ?? []) : [];
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
