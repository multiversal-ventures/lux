import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useCaseDocuments, type CaseDocumentRow } from "./useCaseDocuments.js";

/**
 * Composable, paginated, filterable document picker for one case.
 *
 * The component is **controlled by `selectedIds` / `onSelectedIdsChange`** so
 * the host (e.g. CreateScenarioPage) can attach the picker straight to its
 * form state without juggling refs. Filters and pagination are internal
 * state — exposing them as props is rarely useful and just adds API surface.
 *
 * Host styling lands through `classNames` (root, table, head, row, cell)
 * and host content lands through `slots` (empty/loading/error/title).
 * Defaults are intentionally minimal CSS so this composes cleanly with
 * Tailwind, CSS modules, or vanilla.
 */
export interface CaseDocumentPickerClassNames {
  root?: string;
  filters?: string;
  searchInput?: string;
  yearSelect?: string;
  bulkBar?: string;
  table?: string;
  thead?: string;
  th?: string;
  tbody?: string;
  row?: string;
  rowSelected?: string;
  checkboxCell?: string;
  pagination?: string;
}

export interface CaseDocumentPickerSlots {
  /** Override the empty-state UI (no documents at all). */
  empty?: ReactNode;
  /** Override the loading state. */
  loading?: ReactNode;
  /** Override the error state. */
  error?: (err: Error) => ReactNode;
  /** Optional heading rendered above the filters bar. */
  title?: ReactNode;
  /** Optional action area on the right of the filters bar. */
  rightAction?: ReactNode;
}

export interface CaseDocumentPickerProps {
  caseId: string | null;
  /** Currently selected document ids. */
  selectedIds: string[];
  /** Replace the selection in response to user input. */
  onSelectedIdsChange: (ids: string[]) => void;
  /** Page size. Default 5. */
  pageSize?: number;
  /** Override the row set entirely (advanced — skips the data hook). */
  rows?: CaseDocumentRow[];
  classNames?: CaseDocumentPickerClassNames;
  slots?: CaseDocumentPickerSlots;
  style?: CSSProperties;
  disabled?: boolean;
  /** Click handler for the "view" affordance — receives the row. */
  onViewDocument?: (row: CaseDocumentRow) => void;
}

const DEFAULT_PAGE_SIZE = 5;

export function CaseDocumentPicker({
  caseId,
  selectedIds,
  onSelectedIdsChange,
  pageSize = DEFAULT_PAGE_SIZE,
  rows: rowsProp,
  classNames,
  slots,
  style,
  disabled = false,
  onViewDocument,
}: CaseDocumentPickerProps) {
  const dataHook = useCaseDocuments(rowsProp ? null : caseId);
  const rows = rowsProp ?? dataHook.rows;
  const isLoading = rowsProp ? false : dataHook.isLoading;
  const error = rowsProp ? null : dataHook.error;

  const [searchClass, setSearchClass] = useState("");
  const [searchYear, setSearchYear] = useState<string>("");
  const [page, setPage] = useState(1);
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      if (row.taxYear != null) set.add(String(row.taxYear));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchClass.trim().toLowerCase();
    return rows.filter((row) => {
      const matchYear = !searchYear || String(row.taxYear ?? "") === searchYear;
      if (!matchYear) return false;
      if (!q) return true;
      return (
        row.displayName.toLowerCase().includes(q) ||
        (row.docType?.toLowerCase().includes(q) ?? false) ||
        (row.filename?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, searchClass, searchYear]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page when filters change.
  useEffect(() => {
    setPage(1);
  }, [searchClass, searchYear]);

  // Tristate header checkbox.
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    const selectedCount = filtered.filter((row) => selectedIds.includes(row.id)).length;
    el.indeterminate = selectedCount > 0 && selectedCount < filtered.length;
  }, [filtered, selectedIds]);

  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id));

  const setSelected = (next: string[]) => {
    onSelectedIdsChange(next);
  };

  const toggleAll = (checked: boolean) => {
    const ids = filtered.map((r) => r.id);
    if (checked) {
      setSelected(Array.from(new Set([...selectedIds, ...ids])));
    } else {
      const removed = new Set(ids);
      setSelected(selectedIds.filter((id) => !removed.has(id)));
    }
  };

  const toggleRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelected(selectedIds.filter((x) => x !== id));
    } else {
      setSelected([...selectedIds, id]);
    }
  };

  if (isLoading) return <>{slots?.loading ?? <div>Loading documents…</div>}</>;
  if (error) return <>{slots?.error?.(error) ?? <div role="alert">{error.message}</div>}</>;
  if (rows.length === 0) {
    return <>{slots?.empty ?? <div>No documents found.</div>}</>;
  }

  return (
    <div className={classNames?.root} style={style}>
      {slots?.title}

      <div className={classNames?.filters}>
        <input
          type="text"
          value={searchClass}
          onChange={(e) => setSearchClass(e.target.value)}
          placeholder="Filter by document class…"
          className={classNames?.searchInput}
          disabled={disabled}
        />
        <select
          value={searchYear}
          onChange={(e) => setSearchYear(e.target.value)}
          className={classNames?.yearSelect}
          disabled={disabled}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {slots?.rightAction}
      </div>

      <div className={classNames?.bulkBar}>
        <button
          type="button"
          onClick={() => toggleAll(true)}
          disabled={disabled || filtered.length === 0}
        >
          Select all
        </button>
        <span aria-hidden>|</span>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          disabled={disabled || filtered.length === 0}
        >
          Deselect all
        </button>
        <span>({filtered.length} filtered)</span>
      </div>

      <table className={classNames?.table}>
        <thead className={classNames?.thead}>
          <tr>
            <th className={[classNames?.th, classNames?.checkboxCell].filter(Boolean).join(" ")}>
              <input
                ref={headerCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={disabled || filtered.length === 0}
                aria-label="Select all visible documents"
              />
            </th>
            <th className={classNames?.th}>Year</th>
            <th className={classNames?.th}>Doc type</th>
            <th className={classNames?.th}>File</th>
            {onViewDocument != null && <th className={classNames?.th}>View</th>}
          </tr>
        </thead>
        <tbody className={classNames?.tbody}>
          {visible.map((row) => {
            const isSelected = selectedIds.includes(row.id);
            const cls = [classNames?.row, isSelected ? classNames?.rowSelected : null]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={row.id} className={cls || undefined}>
                <td className={classNames?.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(row.id)}
                    disabled={disabled}
                    aria-label={`Toggle ${row.displayName}`}
                  />
                </td>
                <td>{row.taxYear ?? "—"}</td>
                <td>{row.displayName.replace(/^\d{4}\s/, "")}</td>
                <td title={row.filename ?? undefined}>{row.filename ?? "—"}</td>
                {onViewDocument != null && (
                  <td>
                    <button
                      type="button"
                      onClick={() => onViewDocument(row)}
                      disabled={disabled}
                      aria-label={`View ${row.displayName}`}
                    >
                      View
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className={classNames?.pagination}>
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
            {filtered.length}
          </span>
          <div>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={disabled || page <= 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={disabled || page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
