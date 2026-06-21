import { useMemo, useState } from "react";
import { roleLabel } from "../../labels.js";
import {
	usePortalOverview,
	usePortalCandidates,
	useAddParty,
	type PartyCandidate,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { PartyDetail } from "./PartyDetail.js";

export interface PartyHubProps {
	caseId: string;
	className?: string;
}

type Filter = "all" | "open" | "verified" | "no_account";

/**
 * Operator Party Hub — a two-pane workspace: a searchable/filterable sidebar of
 * the people & entities on a case, and a central view of the selected party's
 * conversation, portal link, status, and shared documents. Composed from lux.
 */
export function PartyHub({ caseId, className }: PartyHubProps) {
	const overview = usePortalOverview(caseId);
	const candidates = usePortalCandidates(caseId);
	const addParty = useAddParty(caseId);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [name, setName] = useState("");
	const [role, setRole] = useState("borrower");

	const parties = overview.data?.parties ?? [];
	const filtered = useMemo(() => filterParties(parties, search, filter), [parties, search, filter]);
	const selected = parties.find((p) => p.party_id === selectedId) ?? filtered[0] ?? null;

	function addManual() {
		const n = name.trim();
		if (!n) return;
		addParty.mutate({ party_type: "individual", display_name: n, role: role || null, linked_identity_id: null });
		setName("");
	}

	function addFromCandidate(c: PartyCandidate) {
		addParty.mutate({
			party_type: c.party_type ?? "individual",
			role: c.role ?? null,
			display_name: c.display_name ?? null,
			linked_identity_id: c.identity_id ?? null,
		});
	}

	if (overview.error) {
		return <div className={`p-6 ${className ?? ""}`}><p className="text-sm text-red-600">Couldn't load this case's parties.</p></div>;
	}

	return (
		<div className={`flex h-full bg-slate-50 ${className ?? ""}`}>
			{/* Sidebar */}
			<aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
				<div className="p-4 border-b border-slate-100">
					<h1 className="font-semibold text-slate-900">People on this case</h1>
					<input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search name or role…"
						className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
					/>
					<div className="mt-2 flex flex-wrap gap-1">
						{(["all", "open", "verified", "no_account"] as Filter[]).map((f) => (
							<button
								key={f}
								type="button"
								onClick={() => setFilter(f)}
								className={`text-[11px] rounded-full px-2 py-0.5 ${filter === f ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
							>
								{FILTER_LABEL[f]}
							</button>
						))}
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{filtered.length === 0 ? (
						<p className="p-4 text-sm text-slate-400">No matching people.</p>
					) : (
						filtered.map((p) => <PartyRow key={p.party_id} party={p} active={p.party_id === selected?.party_id} onClick={() => setSelectedId(p.party_id)} />)
					)}
				</div>

				{/* Add party */}
				<div className="border-t border-slate-200 p-3 space-y-2">
					<p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Add a person</p>
					<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
					<div className="flex gap-2">
						<input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g. borrower)" className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
						<button type="button" onClick={addManual} disabled={!name.trim() || addParty.isPending} className="rounded-lg bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white text-sm px-3">Add</button>
					</div>
					{(candidates.data ?? []).length > 0 && (
						<div className="pt-1">
							<p className="text-[11px] text-slate-400 mb-1">From this case</p>
							<div className="flex flex-wrap gap-1">
								{(candidates.data ?? []).map((c) => (
									<button key={c.identity_id} type="button" onClick={() => addFromCandidate(c)} disabled={addParty.isPending} className="text-xs rounded-full border border-slate-300 hover:bg-slate-100 px-2 py-1 disabled:opacity-50">
										+ {c.display_name || roleLabel(c.role)}
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</aside>

			{/* Center */}
			<main className="flex-1 min-w-0">
				{overview.isLoading ? (
					<div className="p-6 text-slate-500">Loading…</div>
				) : selected ? (
					<PartyDetail
						caseId={caseId}
						party={selected}
						uploadedFiles={overview.data?.uploaded_files ?? []}
						caseDocuments={overview.data?.case_documents ?? []}
						onRemoved={() => setSelectedId(null)}
					/>
				) : (
					<div className="h-full flex items-center justify-center text-slate-400 text-sm">Select a person, or add one from the sidebar.</div>
				)}
			</main>
		</div>
	);
}

const FILTER_LABEL: Record<Filter, string> = {
	all: "All",
	open: "Awaiting reply",
	verified: "Verified",
	no_account: "No account",
};

function filterParties(parties: PartyView[], search: string, filter: Filter): PartyView[] {
	const q = search.trim().toLowerCase();
	return parties.filter((p) => {
		if (q && !(`${p.display_name ?? ""} ${roleLabel(p.role)}`.toLowerCase().includes(q))) return false;
		if (filter === "open") return p.thread.some((m) => m.kind === "request" && m.status === "open");
		if (filter === "verified") return p.verified;
		if (filter === "no_account") return !p.has_account;
		return true;
	});
}

function PartyRow({ party, active, onClick }: { party: PartyView; active: boolean; onClick: () => void }) {
	const open = party.thread.some((m) => m.kind === "request" && m.status === "open");
	return (
		<button
			type="button"
			onClick={onClick}
			className={`w-full text-left px-4 py-3 border-b border-slate-50 ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
		>
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-slate-800 truncate">{party.display_name || roleLabel(party.role)}</span>
				<span className={`h-2 w-2 rounded-full shrink-0 ${party.verified ? "bg-green-500" : open ? "bg-amber-400" : "bg-slate-300"}`} />
			</div>
			<span className="text-xs text-slate-500">{roleLabel(party.role)}</span>
		</button>
	);
}
