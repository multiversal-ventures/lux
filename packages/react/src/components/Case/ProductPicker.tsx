import type { CSSProperties, ReactNode } from "react";

/**
 * Stateless product chip-group picker.
 *
 * The component is intentionally minimal: it takes a list of products and
 * a selection mode (`multiple` or `single`), and emits the new selection
 * on every change. Display name, agency labels, and disabled state are
 * passed in by the host so this component never depends on any specific
 * product registry shape.
 */
export interface ProductOption {
  id: string;
  label: string;
  /** When false, the chip is rendered greyed-out with optional `disabledHint`. */
  enabled: boolean;
  /** Optional hint shown next to the label when disabled (e.g. "Soon"). */
  disabledHint?: string;
}

export interface ProductPickerClassNames {
  root?: string;
  chip?: string;
  chipSelected?: string;
  chipDisabled?: string;
  hint?: string;
}

export interface ProductPickerProps {
  /** Selected product ids. */
  value: string[];
  onChange: (next: string[]) => void;
  options: ProductOption[];
  /** Selection mode. Default `multiple`. */
  mode?: "multiple" | "single";
  classNames?: ProductPickerClassNames;
  style?: CSSProperties;
  disabled?: boolean;
  /** Custom chip renderer for full host control. */
  renderChip?: (option: ProductOption, isSelected: boolean) => ReactNode;
}

export function ProductPicker({
  value,
  onChange,
  options,
  mode = "multiple",
  classNames,
  style,
  disabled = false,
  renderChip,
}: ProductPickerProps) {
  const toggle = (id: string, enabled: boolean) => {
    if (!enabled || disabled) return;
    if (mode === "single") {
      onChange([id]);
      return;
    }
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className={classNames?.root} style={style} role={mode === "single" ? "radiogroup" : "group"}>
      {options.map((option) => {
        const isSelected = value.includes(option.id);
        const cls = [
          classNames?.chip,
          isSelected ? classNames?.chipSelected : null,
          !option.enabled ? classNames?.chipDisabled : null,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={option.id}
            type="button"
            role={mode === "single" ? "radio" : undefined}
            aria-checked={mode === "single" ? isSelected : undefined}
            aria-pressed={mode === "multiple" ? isSelected : undefined}
            disabled={disabled || !option.enabled}
            onClick={() => toggle(option.id, option.enabled)}
            className={cls || undefined}
          >
            {renderChip ? (
              renderChip(option, isSelected)
            ) : (
              <>
                {option.label}
                {!option.enabled && option.disabledHint && (
                  <span className={classNames?.hint}> {option.disabledHint}</span>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
