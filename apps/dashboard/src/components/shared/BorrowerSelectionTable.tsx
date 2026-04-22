import { Building2, User } from "lucide-react";
import { useMemo, useRef, useState } from "react";

// Role display configuration
const ROLE_DISPLAY: Record<string, { label: string; badgeClass: string; hint?: string }> = {
	primary: { label: "Primary", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
	taxpayer: {
		label: "Primary",
		badgeClass: "bg-blue-100 text-blue-700 border-blue-200",
		hint: "from 1040",
	},
	borrower: { label: "Borrower", badgeClass: "bg-blue-100 text-blue-700 border-blue-200" },
	spouse: {
		label: "Co-Borrower",
		badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
		hint: "spouse",
	},
	co_borrower: {
		label: "Co-Borrower",
		badgeClass: "bg-purple-100 text-purple-700 border-purple-200",
	},
	employee: { label: "Employee", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
	payer: {
		label: "Payer",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "1099",
	},
	recipient: {
		label: "Recipient",
		badgeClass: "bg-teal-100 text-teal-700 border-teal-200",
		hint: "1099",
	},
	employer: {
		label: "Employer",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "W-2",
	},
	sole_proprietorship: {
		label: "Self-Employment",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "Sch C",
	},
	partnership: {
		label: "Partnership",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "K-1",
	},
	scorp: {
		label: "S-Corp",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "K-1",
	},
	ccorp: {
		label: "C-Corp",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "1120",
	},
	farm: {
		label: "Farm",
		badgeClass: "bg-amber-100 text-amber-700 border-amber-200",
		hint: "Sch F",
	},
	business: { label: "Business", badgeClass: "bg-amber-100 text-amber-700 border-amber-200" },
	unknown: { label: "Unknown", badgeClass: "bg-slate-100 text-slate-500 border-slate-200" },
};

function getRoleDisplay(role: string) {
	return (
		ROLE_DISPLAY[role.toLowerCase()] ?? {
			label: role,
			badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
		}
	);
}

function formatIdentityType(type: string): string {
	const typeMap: Record<string, string> = {
		person: "Individual",
		employer: "Employer",
		partnership: "Partnership",
		sole_proprietorship: "Sole Proprietorship",
		scorp: "S-Corp",
		ccorp: "C-Corp",
		farm: "Farm",
		business: "Business",
		unknown: "Unknown",
	};
	return typeMap[type?.toLowerCase()] || type || "Unknown";
}

function isBusinessType(type: string): boolean {
	const businessTypes = [
		"employer",
		"partnership",
		"sole_proprietorship",
		"scorp",
		"ccorp",
		"farm",
		"business",
	];
	return businessTypes.includes(type?.toLowerCase());
}

export interface Borrower {
	id: string;
	name: string;
	role: string;
	type: string;
}

interface BorrowerSelectionTableProps {
	borrowers: Borrower[];
	selectedIds: string[];
	onSelectionChange: (ids: string[]) => void;
	disabled?: boolean;
}

/**
 * BorrowerSelectionTable - Reusable borrower selection with filters.
 *
 * Features:
 * - Name search
 * - Role filter
 * - Type filter
 * - Select all / Deselect all (filtered)
 * - Table display with role badges
 */
export function BorrowerSelectionTable({
	borrowers,
	selectedIds,
	onSelectionChange,
	disabled = false,
}: BorrowerSelectionTableProps) {
	const [searchName, setSearchName] = useState("");
	const [filterRole, setFilterRole] = useState("");
	const [filterType, setFilterType] = useState("");
	const selectAllRef = useRef<HTMLInputElement | null>(null);

	// Unique roles from borrowers
	const roles = useMemo(() => {
		const roleSet = new Set(borrowers.map((b) => b.role).filter(Boolean));
		return Array.from(roleSet).sort();
	}, [borrowers]);

	// Unique types from borrowers
	const types = useMemo(() => {
		const typeSet = new Set(borrowers.map((b) => b.type).filter(Boolean));
		return Array.from(typeSet).sort();
	}, [borrowers]);

	// Filter borrowers
	const filteredBorrowers = useMemo(() => {
		return borrowers.filter((b) => {
			const matchName =
				!searchName.trim() || b.name.toLowerCase().includes(searchName.trim().toLowerCase());
			const matchRole = !filterRole || b.role === filterRole;
			const matchType = !filterType || b.type === filterType;
			return matchName && matchRole && matchType;
		});
	}, [borrowers, searchName, filterRole, filterType]);

	const toggleBorrower = (id: string) => {
		if (selectedIds.includes(id)) {
			onSelectionChange(selectedIds.filter((bid) => bid !== id));
		} else {
			onSelectionChange([...selectedIds, id]);
		}
	};

	const selectAllFiltered = () => {
		const ids = filteredBorrowers.map((b) => b.id);
		onSelectionChange(Array.from(new Set([...selectedIds, ...ids])));
	};

	const deselectAllFiltered = () => {
		const ids = new Set(filteredBorrowers.map((b) => b.id));
		onSelectionChange(selectedIds.filter((id) => !ids.has(id)));
	};

	const allFilteredSelected =
		filteredBorrowers.length > 0 && filteredBorrowers.every((b) => selectedIds.includes(b.id));

	return (
		<div className="space-y-3">
			{/* Filters */}
			<div className="flex flex-wrap items-center gap-3">
				<input
					type="text"
					value={searchName}
					onChange={(e) => setSearchName(e.target.value)}
					placeholder="Search by name..."
					disabled={disabled}
					className="flex-1 min-w-[140px] px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
				/>
				<select
					value={filterRole}
					onChange={(e) => setFilterRole(e.target.value)}
					disabled={disabled}
					className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
				>
					<option value="">All roles</option>
					{roles.map((role) => (
						<option key={role} value={role}>
							{getRoleDisplay(role).label}
						</option>
					))}
				</select>
				<select
					value={filterType}
					onChange={(e) => setFilterType(e.target.value)}
					disabled={disabled}
					className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
				>
					<option value="">All types</option>
					{types.map((type) => (
						<option key={type} value={type}>
							{formatIdentityType(type)}
						</option>
					))}
				</select>
			</div>

			{/* Bulk select */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={selectAllFiltered}
					disabled={disabled}
					className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
				>
					Select all
				</button>
				<span className="text-slate-300">|</span>
				<button
					type="button"
					onClick={deselectAllFiltered}
					disabled={disabled}
					className="text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50"
				>
					Deselect all
				</button>
				<span className="text-xs text-slate-500">
					(applies to {filteredBorrowers.length} filtered)
				</span>
			</div>

			{/* Table */}
			<div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
				{filteredBorrowers.length === 0 ? (
					<div className="px-4 py-6 text-center text-sm text-slate-500">
						No borrowers match the current filters.
					</div>
				) : (
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b border-slate-200 bg-slate-50">
								<th className="w-10 px-4 py-3 text-left">
									<input
										ref={selectAllRef}
										type="checkbox"
										checked={allFilteredSelected}
										onChange={(e) => {
											if (e.target.checked) {
												selectAllFiltered();
											} else {
												deselectAllFiltered();
											}
										}}
										disabled={disabled}
										className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
									/>
								</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs">
									Name
								</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs">
									Role
								</th>
								<th className="px-4 py-3 text-left font-semibold text-slate-600 uppercase tracking-wide text-xs">
									Type
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{filteredBorrowers.map((borrower) => {
								const display = getRoleDisplay(borrower.role);
								return (
									<tr
										key={borrower.id}
										className={`hover:bg-slate-50 transition-colors ${disabled ? "opacity-50" : ""}`}
									>
										<td className="w-10 px-4 py-3">
											<input
												type="checkbox"
												checked={selectedIds.includes(borrower.id)}
												onChange={() => toggleBorrower(borrower.id)}
												disabled={disabled}
												className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
											/>
										</td>
										<td className="px-4 py-3 text-slate-800 font-medium">
											<span className="flex items-center gap-2">
												{isBusinessType(borrower.type) ? (
													<Building2 className="w-4 h-4 text-slate-400 shrink-0" />
												) : (
													<User className="w-4 h-4 text-slate-400 shrink-0" />
												)}
												{borrower.name}
											</span>
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${display.badgeClass}`}
											>
												{display.label}
												{display.hint && (
													<span className="text-[10px] opacity-70">({display.hint})</span>
												)}
											</span>
										</td>
										<td className="px-4 py-3 text-slate-600">
											{formatIdentityType(borrower.type)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}

export default BorrowerSelectionTable;
