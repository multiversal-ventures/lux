import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  useCaseIdentities,
  type CaseIdentityRow,
  type UseCaseIdentitiesOptions,
} from "./useCaseIdentities.js";

/**
 * Composable identity picker (borrowers + business entities).
 *
 * Sources identities through `useCaseIdentities`, which prefers the most
 * recent completed scenario's refinement and falls back to the case-level
 * entities endpoint. Hosts can override `rows` to drive the component from
 * any source (e.g. a virtualized list or a custom merge).
 */
export interface CaseIdentityPickerClassNames {
  root?: string;
  filters?: string;
  searchInput?: string;
  roleSelect?: string;
  typeSelect?: string;
  bulkBar?: string;
  table?: string;
  thead?: string;
  th?: string;
  tbody?: string;
  row?: string;
  rowSelected?: string;
  checkboxCell?: string;
  badge?: string;
  needsReviewBadge?: string;
}

export interface CaseIdentityPickerSlots {
  empty?: ReactNode;
  loading?: ReactNode;
  error?: (err: Error) => ReactNode;
  title?: ReactNode;
  /** Custom renderer for the role badge. */
  roleBadge?: (row: CaseIdentityRow) => ReactNode;
  /** Custom renderer for the type cell. */
  typeCell?: (row: CaseIdentityRow) => ReactNode;
}

export interface CaseIdentityPickerProps {
  caseId: string | null;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** Options forwarded to `useCaseIdentities` (e.g. pin to a scenario). */
  identitiesOptions?: UseCaseIdentitiesOptions;
  /** Override the row set entirely. */
  rows?: CaseIdentityRow[];
  classNames?: CaseIdentityPickerClassNames;
  slots?: CaseIdentityPickerSlots;
  style?: CSSProperties;
  disabled?: boolean;
}

/**
 * Generic slug → human-readable fallback.
 *
 * Used ONLY when the backend hasn't supplied a display string for a
 * given row (e.g. an entity with no curated entity_type_label). The
 * hand-maintained ROLE_LABEL / TYPE_LABEL dicts that used to live here
 * have been removed — display labels come from the backend's
 * ``policy/specs/display_labels.yaml`` registry via
 * ``IdentityInfo.role`` / ``IdentityInfo.entity_type``.
 */
function humanizeSlug(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CaseIdentityPicker({
  caseId,
  selectedIds,
  onSelectedIdsChange,
  identitiesOptions,
  rows: rowsProp,
  classNames,
  slots,
  style,
  disabled = false,
}: CaseIdentityPickerProps) {
  const dataHook = useCaseIdentities(rowsProp ? null : caseId, identitiesOptions ?? {});
  const rows = rowsProp ?? dataHook.rows;
  const isLoading = rowsProp ? false : dataHook.isLoading;
  const error = rowsProp ? null : dataHook.error;

  const [searchName, setSearchName] = useState("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  // ``roleOptions`` carries both the stable slug (used as the <option>
  // value and the filter predicate) and a display label resolved from
  // the first row that exposes one. This keeps the dropdown labels
  // backend-driven without losing the slug-as-source-of-truth filter
  // semantics. Rows with no ``roleLabel`` (entities without a curated
  // display role) fall back to a humanised slug so the dropdown never
  // shows a bare key like ``business_entity``.
  const roleOptions = useMemo(() => {
    const labels = new Map<string, string>();
    for (const row of rows) {
      if (!row.role) continue;
      const existing = labels.get(row.role);
      if (existing && existing !== row.role) continue;
      labels.set(row.role, row.roleLabel || humanizeSlug(row.role));
    }
    return Array.from(labels.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  const typeOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      if (row.entityType) seen.add(row.entityType);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return rows.filter((row) => {
      const matchName = !q || row.name.toLowerCase().includes(q);
      const matchRole = !filterRole || row.role === filterRole;
      const matchType = !filterType || row.entityType === filterType;
      return matchName && matchRole && matchType;
    });
  }, [rows, searchName, filterRole, filterType]);

  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    const selectedCount = filtered.filter((row) => selectedIds.includes(row.id)).length;
    el.indeterminate = selectedCount > 0 && selectedCount < filtered.length;
  }, [filtered, selectedIds]);

  const allSelected = filtered.length > 0 && filtered.every((row) => selectedIds.includes(row.id));

  const setSelected = (next: string[]) => onSelectedIdsChange(next);

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

  if (isLoading) return <>{slots?.loading ?? <div>Loading identities…</div>}</>;
  if (error) return <>{slots?.error?.(error) ?? <div role="alert">{error.message}</div>}</>;
  if (rows.length === 0) return <>{slots?.empty ?? <div>No identities found.</div>}</>;

  return (
    <div className={classNames?.root} style={style}>
      {slots?.title}

      <div className={classNames?.filters}>
        <input
          type="text"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          placeholder="Search by name…"
          className={classNames?.searchInput}
          disabled={disabled}
        />
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className={classNames?.roleSelect}
          disabled={disabled}
        >
          <option value="">All roles</option>
          {roleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className={classNames?.typeSelect}
          disabled={disabled}
        >
          <option value="">All types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
                aria-label="Select all visible identities"
              />
            </th>
            <th className={classNames?.th}>Name</th>
            <th className={classNames?.th}>Role</th>
            <th className={classNames?.th}>Type</th>
          </tr>
        </thead>
        <tbody className={classNames?.tbody}>
          {filtered.map((row) => {
            const isSelected = selectedIds.includes(row.id);
            const cls = [classNames?.row, isSelected ? classNames?.rowSelected : null]
              .filter(Boolean)
              .join(" ");
            // Prefer the backend-supplied display label; fall back to a
            // humanised slug so a brand-new role_hint without a YAML entry
            // still renders something readable until the registry catches
            // up.
            const roleBadge = slots?.roleBadge?.(row) ?? (
              <span className={classNames?.badge}>
                {row.roleLabel || humanizeSlug(row.role)}
              </span>
            );
            const typeCell =
              slots?.typeCell?.(row) ?? (row.entityType || humanizeSlug(row.role));
            return (
              <tr key={row.id} className={cls || undefined}>
                <td className={classNames?.checkboxCell}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleRow(row.id)}
                    disabled={disabled}
                    aria-label={`Toggle ${row.name}`}
                  />
                </td>
                <td>
                  <span>{row.name}</span>
                  {row.needsReview && (
                    <span className={classNames?.needsReviewBadge}> Needs review</span>
                  )}
                </td>
                <td>{roleBadge}</td>
                <td>{typeCell}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
