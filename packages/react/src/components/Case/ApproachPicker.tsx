import type { CSSProperties, ReactNode } from "react";

/**
 * Approach selector — QM vs Non-QM (vs custom). Stateless, controlled.
 *
 * Hosts provide the list of approaches because the available approaches
 * (and their descriptions) are policy-domain decisions, not Lux concerns.
 */
export interface ApproachOption {
  id: string;
  /** Card title. */
  label: string;
  /** Subtitle / description shown under the label. */
  description?: string;
  disabled?: boolean;
}

export interface ApproachPickerClassNames {
  root?: string;
  card?: string;
  cardSelected?: string;
  cardDisabled?: string;
  title?: string;
  description?: string;
}

export interface ApproachPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  options: ApproachOption[];
  classNames?: ApproachPickerClassNames;
  style?: CSSProperties;
  disabled?: boolean;
  /** Custom card renderer; defaults to label + description. */
  renderCard?: (option: ApproachOption, isSelected: boolean) => ReactNode;
}

export function ApproachPicker({
  value,
  onChange,
  options,
  classNames,
  style,
  disabled = false,
  renderCard,
}: ApproachPickerProps) {
  return (
    <div className={classNames?.root} style={style} role="radiogroup">
      {options.map((option) => {
        const isSelected = option.id === value;
        const isDisabled = disabled || option.disabled === true;
        const cls = [
          classNames?.card,
          isSelected ? classNames?.cardSelected : null,
          isDisabled ? classNames?.cardDisabled : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(option.id)}
            className={cls || undefined}
          >
            {renderCard ? (
              renderCard(option, isSelected)
            ) : (
              <>
                <div className={classNames?.title}>{option.label}</div>
                {option.description && (
                  <div className={classNames?.description}>{option.description}</div>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
