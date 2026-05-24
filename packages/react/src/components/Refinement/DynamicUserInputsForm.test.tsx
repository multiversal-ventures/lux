import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  DynamicUserInputsForm,
  DynamicUserInputsFormFields,
  applyContextChange,
  validateInitialRequiredInputs,
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

  // Free-form numeric variant of expense_factor (no options[] → numeric input)
  // — exercises the YAML `default` fallback that wasn't there before.
  const NUMERIC_SCHEMA = {
    products: [
      {
        product_id: "non_qm_bank_statement",
        display_name: "Non-QM Bank Statement",
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
            step: 0.01,
            unit: "percent",
            options: [],
            derive_options_from: null,
            spec_name: "non_qm_bank_statement_income",
          },
        ],
      },
    ],
  };

  it("displays YAML default in the numeric input when context is empty", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DynamicUserInputsForm
        schema={NUMERIC_SCHEMA as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    const input = getByLabelText("Expense Factor") as HTMLInputElement;
    expect(input.tagName).toBe("INPUT");
    expect(input.type).toBe("number");
    // 0.9 fraction → "90" in the percent display.
    expect(input.value).toBe("90");
  });

  it("prefers prior refinement context over the YAML default", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DynamicUserInputsForm
        schema={NUMERIC_SCHEMA as never}
        value={{ non_qm_bank_statement: { inputs: { expense_factor: 0.5 } } }}
        onContextChange={onChange}
      />,
    );
    const input = getByLabelText("Expense Factor") as HTMLInputElement;
    // 0.5 fraction → "50" in the percent display.
    expect(input.value).toBe("50");
  });

  it("renders the YAML unit as a suffix next to numeric inputs", () => {
    const onChange = vi.fn();
    const { getByLabelText, getByText } = render(
      <DynamicUserInputsForm
        schema={NUMERIC_SCHEMA as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    // Suffix sits next to the input; both share a wrapper.
    const input = getByLabelText("Expense Factor") as HTMLInputElement;
    expect(input).toBeTruthy();
    // ``percent`` slug → ``%`` suffix.
    expect(getByText("%")).toBeTruthy();
  });

  it("omits the unit suffix when no unit is declared on the spec", () => {
    const onChange = vi.fn();
    const noUnit = {
      products: [
        {
          product_id: "non_qm_bank_statement",
          display_name: "Non-QM Bank Statement",
          fields: [
            {
              name: "raw_count",
              type: "integer",
              label: "Raw Count",
              hint: null,
              default: null,
              required: false,
              minimum: 0,
              maximum: null,
              step: 1,
              unit: null,
              options: [],
              derive_options_from: null,
              spec_name: "test_spec",
            },
          ],
        },
      ],
    };
    const { queryByText, getByLabelText } = render(
      <DynamicUserInputsForm
        schema={noUnit as never}
        value={{}}
        onContextChange={onChange}
      />,
    );
    expect(getByLabelText("Raw Count")).toBeTruthy();
    expect(queryByText("%")).toBeNull();
    expect(queryByText("USD")).toBeNull();
  });
});

const DSCR_FIELDS = [
  {
    name: "proposed_loan_amount",
    type: "currency",
    label: "Proposed Loan Amount",
    hint: null,
    default: null,
    required: true,
    required_at_create: true,
    minimum: 1,
    maximum: 100_000_000,
    step: 1,
    unit: "usd",
    options: [],
    derive_options_from: null,
    spec_name: "dscr_ratio_calculation",
  },
  {
    name: "proposed_annual_rate",
    type: "percent",
    label: "Proposed Annual Rate",
    hint: null,
    default: null,
    required: true,
    required_at_create: true,
    minimum: 0,
    maximum: 1,
    step: 0.001,
    unit: "percent",
    options: [],
    derive_options_from: null,
    spec_name: "dscr_ratio_calculation",
  },
  {
    name: "proposed_term_months",
    type: "integer",
    label: "Proposed Term (months)",
    hint: null,
    default: null,
    required: true,
    required_at_create: true,
    minimum: 1,
    maximum: 600,
    step: 1,
    unit: "months",
    options: [],
    derive_options_from: null,
    spec_name: "dscr_ratio_calculation",
  },
];

describe("DynamicUserInputsFormFields", () => {
  it("renders one input per field from a flat list", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DynamicUserInputsFormFields
        fields={DSCR_FIELDS as never}
        value={{}}
        onChange={onChange}
      />,
    );
    expect(getByLabelText("Proposed Loan Amount")).toBeTruthy();
    expect(getByLabelText("Proposed Annual Rate")).toBeTruthy();
    expect(getByLabelText("Proposed Term (months)")).toBeTruthy();
  });

  it("emits (fieldName, value) on change", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <DynamicUserInputsFormFields
        fields={DSCR_FIELDS as never}
        value={{}}
        onChange={onChange}
      />,
    );
    fireEvent.change(getByLabelText("Proposed Loan Amount"), {
      target: { value: "500000" },
    });
    expect(onChange).toHaveBeenCalledWith("proposed_loan_amount", 500000);
  });

  it("renders inline error text from the errors map", () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <DynamicUserInputsFormFields
        fields={DSCR_FIELDS as never}
        value={{ proposed_loan_amount: 0 }}
        onChange={onChange}
        errors={{ proposed_loan_amount: "Proposed Loan Amount must be at least 1" }}
      />,
    );
    expect(
      getByText("Proposed Loan Amount must be at least 1"),
    ).toBeTruthy();
  });

  it("renders nothing for an empty fields list", () => {
    const onChange = vi.fn();
    const { container } = render(
      <DynamicUserInputsFormFields fields={[]} value={{}} onChange={onChange} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("validateInitialRequiredInputs", () => {
  it("flags missing required-at-create fields", () => {
    const errors = validateInitialRequiredInputs(DSCR_FIELDS as never, {});
    expect(errors).toEqual({
      proposed_loan_amount: "Proposed Loan Amount is required",
      proposed_annual_rate: "Proposed Annual Rate is required",
      proposed_term_months: "Proposed Term (months) is required",
    });
  });

  it("flags out-of-range numeric values", () => {
    const errors = validateInitialRequiredInputs(DSCR_FIELDS as never, {
      proposed_loan_amount: 0,
      proposed_annual_rate: 1.5,
      proposed_term_months: 12,
    });
    expect(errors.proposed_loan_amount).toContain("at least 1");
    expect(errors.proposed_annual_rate).toContain("at most 1");
    expect(errors.proposed_term_months).toBeUndefined();
  });

  it("passes with all values in range", () => {
    const errors = validateInitialRequiredInputs(DSCR_FIELDS as never, {
      proposed_loan_amount: 500_000,
      proposed_annual_rate: 0.075,
      proposed_term_months: 360,
    });
    expect(errors).toEqual({});
  });

  it("respects ``requiredAtCreateOnly: false`` for non-create flows", () => {
    const fields = [
      {
        ...DSCR_FIELDS[0],
        required: true,
        required_at_create: false,
      },
    ];
    const create = validateInitialRequiredInputs(fields as never, {});
    expect(create).toEqual({});
    const refine = validateInitialRequiredInputs(fields as never, {}, {
      requiredAtCreateOnly: false,
    });
    expect(refine).toEqual({
      proposed_loan_amount: "Proposed Loan Amount is required",
    });
  });
});
