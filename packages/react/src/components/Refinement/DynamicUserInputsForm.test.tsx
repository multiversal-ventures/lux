import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DynamicUserInputsForm,
  applyContextChange,
  type RefinementContext,
} from "./DynamicUserInputsForm.js";

const SCHEMA = {
  products: [
    {
      product_id: "non_qm",
      display_name: "Non-QM",
      fields: [
        {
          name: "expense_factor",
          type: "percent",
          label: "Expense Factor",
          hint: "Deduction percentage",
          default: 0.9,
          required: false,
          minimum: 0,
          maximum: 1,
          step: 0.05,
          unit: "percent",
          options: [
            { value: 0.5, label: "50%" },
            { value: 0.9, label: "90% (default)" },
          ],
          derive_options_from: null,
          spec_name: "non_qm_bank_statement_income",
        },
      ],
    },
    {
      product_id: "fannie_mae",
      display_name: "Fannie Mae",
      fields: [],
    },
  ],
};

describe("applyContextChange", () => {
  it("nests value under product → inputs", () => {
    const next = applyContextChange({}, "non_qm", "expense_factor", 0.5);
    expect(next).toEqual({ non_qm: { inputs: { expense_factor: 0.5 } } });
  });

  it("deletes the field when value is null", () => {
    const start: RefinementContext = { non_qm: { inputs: { expense_factor: 0.5, foo: "bar" } } };
    const next = applyContextChange(start, "non_qm", "expense_factor", null);
    expect(next).toEqual({ non_qm: { inputs: { foo: "bar" } } });
  });

  it("prunes empty product entries", () => {
    const start: RefinementContext = { non_qm: { inputs: { expense_factor: 0.5 } } };
    const next = applyContextChange(start, "non_qm", "expense_factor", null);
    expect(next).toEqual({});
  });
});

describe("DynamicUserInputsForm", () => {
  it("renders the option select for an enum-style percent field", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DynamicUserInputsForm
        schema={SCHEMA as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    const select = getByLabelText("Expense Factor") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(Array.from(select.options).map((o) => o.text)).toContain("50%");
  });

  it("emits (productId, fieldName, value) on change with the option's native value", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DynamicUserInputsForm
        schema={SCHEMA as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    fireEvent.change(getByLabelText("Expense Factor"), { target: { value: "0.5" } });
    expect(onChange).toHaveBeenCalledWith("non_qm", "expense_factor", 0.5);
  });

  it("renders nothing (default empty slot) when no fields are present", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DynamicUserInputsForm
        schema={{ products: [{ product_id: "fannie_mae", display_name: "Fannie Mae", fields: [] }] } as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    expect(container.textContent ?? "").toContain("No operator-adjustable inputs");
  });

  it("supports per-type renderer override", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <DynamicUserInputsForm
        schema={SCHEMA as never}
        value={{}}
        onContextChange={onChange}
        slots={{
          renderers: {
            percent: () => <span>HOST PERCENT WIDGET</span>,
          },
        }}
      />,
    );
    expect(getByText("HOST PERCENT WIDGET")).toBeTruthy();
  });

  it("skips empty product sections", () => {
    const onChange = vi.fn();
    const { queryByText } = render(
      <DynamicUserInputsForm
        schema={SCHEMA as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    // Non-QM has fields, so its section title shows. Fannie Mae has none.
    expect(queryByText("Non-QM")).toBeTruthy();
    expect(queryByText("Fannie Mae")).toBeNull();
  });
});
