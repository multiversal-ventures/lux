import { useScenarioContext } from "./ScenarioProvider.js";
import styles from "./Scenario.module.css";

const SUMMARY_TAB = "summary";
const SHOW_PRODUCT_TABS_APPROACHES = new Set(["qm_standard"]);

export interface ScenarioTabsProps {
  className?: string;
}

export function ScenarioTabs({ className }: ScenarioTabsProps) {
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
        onClick={() => setActiveProductId(SUMMARY_TAB)}
      >
        Summary
      </button>
      {products.map((p) => (
        <button
          key={p.product_id}
          className={[styles.tab, activeProd === p.product_id ? styles.tabActive : ""].join(" ")}
          onClick={() => setActiveProductId(p.product_id)}
        >
          {p.display_name}
        </button>
      ))}
    </div>
  );
}
