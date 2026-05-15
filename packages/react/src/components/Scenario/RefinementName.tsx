import type { CSSProperties, ReactNode } from "react";
import type { components } from "@fenero/lux-core";
import { useMaybeScenarioContext } from "./ScenarioProvider.js";
import { formatRefinementDisplayName } from "./scenarioDisplay.js";

type RefinementResponse = components["schemas"]["RefinementResponse"];

export interface RefinementNameProps {
  refinement?: RefinementResponse | null;
  /** When `refinement` is omitted, resolve by id from `ScenarioProvider.refinements`. */
  refinementId?: string | null;
  className?: string;
  style?: CSSProperties;
  emptyLabel?: string;
  children?: (label: string) => ReactNode;
}

export function RefinementName({
  refinement: refinementProp,
  refinementId,
  className,
  style,
  emptyLabel = "Refinement",
  children,
}: RefinementNameProps) {
  const maybe = useMaybeScenarioContext();
  let refinement: RefinementResponse | null | undefined = refinementProp ?? undefined;
  if (!refinement && refinementId && maybe?.refinements?.length) {
    refinement = maybe.refinements.find((r) => r.refinement_id === refinementId) ?? null;
  }
  const label = refinement ? formatRefinementDisplayName(refinement) : emptyLabel;
  if (children) return <>{children(label)}</>;
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}
