import { useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, Trash2 } from "lucide-react";
import { roleLabel } from "../../labels.js";
import {
	usePortalOverview,
	usePortalCandidates,
	useDeleteParty,
	type PartyView,
} from "../../hooks/usePartyHub.js";
import { PartyDetail } from "./PartyDetail.js";
import { AddPartyPanel } from "./AddPartyPanel.js";

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
	const del = useDeleteParty(caseId);

	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState<Filter>("all");
	const [collapsed, setCollapsed] = useState(false);

	const parties = overview.data?.parties ?? [];
	const filtered = useMemo(() => filterParties(parties, search, filter), [parties, search, filter]);
	const selected = parties.find((p) => p.party_id === selectedId) ?? filtered[0] ?? null;

	if (overview.error) {
		return <div className={`p-6 ${className ?? ""}`}><p className="text-sm text-red-600">Couldn't load this case's parties.</p></div>;
	}

	return (
		<div className={`flex h-full bg-slate-50 ${className ?? ""}`}>
			{/* Sidebar */}
			{collapsed && (
				<div className="w-10 shrink-0 border-r border-slate-200 bg-white flex flex-col items-center py-3">
					<button type="button" onClick={() => setCollapsed(false)} title="Show people" aria-label="Show people" className="h-8 w-8 rounded hover:bg-slate-100 flex items-center justify-center text-slate-500">
						<PanelLeftOpen size={18} />
					</button>
				</div>
			)}
			<aside className={`${collapsed ? "hidden" : "flex"} w-72 shrink-0 border-r border-slate-200 bg-white flex-col`}>
				<div className="p-4 border-b border-slate-100">
					<div className="flex items-center justify-between">
						<h1 className="font-semibold text-slate-900">People on this case</h1>
						<button type="button" onClick={() => setCollapsed(true)} title="Hide" aria-label="Hide people" className="text-slate-400 hover:text-slate-600">
							<PanelLeftClose size={16} />
						</button>
					</div>
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
						filtered.map((p) => <PartyRow key={p.party_id} party={p} active={p.party_id === selected?.party_id} onClick={() => setSelectedId(p.party_id)} onDelete={() => { if (window.confirm(`Remove ${p.display_name || "this person"} from the portal?`)) del.mutate(p.party_id, { onSuccess: () => { if (selectedId === p.party_id) setSelectedId(null); } }); }} />)
					)}
				</div>

				{/* Add party (email-To style) */}
				<div className="border-t border-slate-200 p-3">
					<AddPartyPanel
						caseId={caseId}
						candidates={candidates.data ?? []}
						caseDocuments={overview.data?.case_documents ?? []}
					/>
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
						officerName={overview.data?.officer_name ?? ""}
						officerAvatar={overview.data?.officer_avatar ?? ""}
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

function PartyRow({ party, active, onClick, onDelete }: { party: PartyView; active: boolean; onClick: () => void; onDelete: () => void }) {
	const open = party.thread.some((m) => m.kind === "request" && m.status === "open");
	return (
		<div
			onClick={onClick}
			className={`group relative w-full cursor-pointer px-4 py-3 ${active ? "bg-indigo-50" : "hover:bg-slate-50"}`}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-sm font-medium text-slate-800 truncate">{party.display_name || roleLabel(party.role)}</span>
				<div className="flex items-center gap-2 shrink-0">
					<button
						type="button"
						onClick={(e) => { e.stopPropagation(); onDelete(); }}
						title="Remove from portal"
						aria-label="Remove from portal"
						className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition"
					>
						<Trash2 size={14} />
					</button>
					<span className={`h-2 w-2 rounded-full ${party.verified ? "bg-green-500" : open ? "bg-amber-400" : "bg-slate-300"}`} />
				</div>
			</div>
			<span className="text-xs text-slate-500">{roleLabel(party.role)}</span>
		</div>
	);
}
