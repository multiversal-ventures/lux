import type { CSSProperties, ReactNode } from "react";

/**
 * Composable tab navigation for the refinement flow.
 *
 * Stateless and headless-friendly: the host owns the active tab and the
 * tab definitions. The component renders the buttons and forwards click
 * events. Hosts can plug any tab content underneath — this only paints
 * the navigation row.
 */
export interface RefinementTabDescriptor<TId extends string = string> {
  id: TId;
  label: ReactNode;
  /** Optional icon (already-rendered React node — pass `<Icon />` from your lib). */
  icon?: ReactNode;
  /** Numeric badge displayed beside the label. Hidden when 0/undefined. */
  badge?: number | null;
  disabled?: boolean;
}

export interface RefinementTabsClassNames {
  root?: string;
  tab?: string;
  tabActive?: string;
  tabDisabled?: string;
  badge?: string;
}

export interface RefinementTabsProps<TId extends string = string> {
  tabs: readonly RefinementTabDescriptor<TId>[];
  activeId: TId;
  onActiveChange: (id: TId) => void;
  classNames?: RefinementTabsClassNames;
  style?: CSSProperties;
}

export function RefinementTabs<TId extends string = string>({
  tabs,
  activeId,
  onActiveChange,
  classNames,
  style,
}: RefinementTabsProps<TId>) {
  return (
    <div className={classNames?.root} style={style} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        const cls = [
          classNames?.tab,
          isActive ? classNames?.tabActive : null,
          tab.disabled ? classNames?.tabDisabled : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onActiveChange(tab.id)}
            className={cls || undefined}
          >
            {tab.icon}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className={classNames?.badge}>{tab.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
