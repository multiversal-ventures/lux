import type { ReactNode } from "react";
import styles from "./Scenario.module.css";

export interface ScenarioTabPanelProps {
  className?: string;
  children?: ReactNode;
}

export function ScenarioTabPanel({ className, children }: ScenarioTabPanelProps) {
  return (
    <div className={[styles.tabPanel, className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}
