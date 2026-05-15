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

const ROLE_LABEL: Record<string, string> = {
  borrower: "Borrower",
  co_borrower: "Co-Borrower",
  taxpayer: "Borrower",
  spouse: "Co-Borrower",
  employer: "Employer",
  employee: "Employee",
  partnership: "Partnership",
  scorp: "S-Corp",
  ccorp: "C-Corp",
  sole_proprietorship: "Sole Proprietor",
  farm: "Farm",
  business: "Business",
  financial_institution: "Financial Institution",
  unknown: "Unknown",
};

const TYPE_LABEL: Record<string, string> = {
  person: "Individual",
  partnership: "Partnership",
  scorp: "S-Corp",
  ccorp: "C-Corp",
  sole_proprietorship: "Sole Proprietorship",
  farm: "Farm",
  employer: "Employer",
  business: "Business",
  financial_institution: "Financial Institution",
  unknown: "Unknown",
};

function formatRole(role: string): string {
  return ROLE_LABEL[role.toLowerCase()] ?? role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatType(type: string): string {
  return TYPE_LABEL[type.toLowerCase()] ?? type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

  const roles = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.role).filter(Boolean))).sort();
  }, [rows]);

  const types = useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.entityType).filter(Boolean))).sort();
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
          {roles.map((role) => (
            <option key={role} value={role}>
              {formatRole(role)}
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
          {types.map((t) => (
            <option key={t} value={t}>
              {formatType(t)}
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
            const roleBadge = slots?.roleBadge?.(row) ?? (
              <span className={classNames?.badge}>{formatRole(row.role)}</span>
            );
            const typeCell = slots?.typeCell?.(row) ?? formatType(row.entityType);
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
