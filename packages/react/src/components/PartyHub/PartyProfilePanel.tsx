import { FileText, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { PartyProfile } from "../../hooks/usePartyHub.js";
import { identifierTypeLabel, partyTypeLabel, roleLabel } from "../../labels.js";
import { Avatar } from "../Avatar.js";

/** "What we know about this party" — the operator profile panel.
 *
 * OPERATOR-facing: identifiers are MASKED (tail only, e.g. "SSN ••• 1234").
 * The full SSN/EIN never reaches the client, so there is nothing here to
 * unmask. Cards mirror the hub's card styling (rounded-xl, border-slate-200,
 * bg-white). Rows with no value are hidden; cards with no rows show an empty
 * state. */
export function PartyProfilePanel({ profile }: { profile: PartyProfile }) {
	const shortId = profile.party_id.slice(0, 8);
	const maskedIdentifier =
		profile.identifier?.last4 && profile.identifier?.type
			? `${identifierTypeLabel(profile.identifier.type)} ••• ${profile.identifier.last4}`
			: null;

	return (
		<div className="flex-1 overflow-y-auto px-5 py-5 bg-slate-50 space-y-4">
			{/* Header: avatar + name + role + short party id */}
			<div className="flex items-center gap-4">
				<Avatar size={64} name={profile.display_name || roleLabel(profile.role)} />
				<div className="min-w-0">
					<h2 className="text-lg font-semibold text-slate-900 truncate">
						{profile.display_name || roleLabel(profile.role)}
					</h2>
					<p className="text-sm text-slate-500">
						{[roleLabel(profile.role), partyTypeLabel(profile.party_type)]
							.filter(Boolean)
							.join(" · ")}
					</p>
					<p className="text-[11px] font-mono text-slate-400 mt-0.5">{shortId}</p>
				</div>
			</div>

			{/* Status chips */}
			<div className="flex flex-wrap gap-2">
				<StatusChip on={!!profile.status?.verified} label="Verified" />
				<StatusChip on={!!profile.status?.signed} label="Signed" />
				<StatusChip on={!!profile.status?.has_account} label="Account" />
			</div>

			{/* Identity card */}
			<Card title="Identity">
				{maskedIdentifier && (
					<Row icon={<ShieldCheck size={14} />} label="Identifier" value={maskedIdentifier} />
				)}
				{profile.email && <Row icon={<Mail size={14} />} label="Email" value={profile.email} />}
				{(profile.phones ?? []).map((p) => (
					<Row key={p} icon={<Phone size={14} />} label="Phone" value={p} />
				))}
				{(profile.addresses ?? []).map((a) => (
					<Row key={a} icon={<MapPin size={14} />} label="Address" value={a} />
				))}
				{!maskedIdentifier &&
					!profile.email &&
					(profile.phones ?? []).length === 0 &&
					(profile.addresses ?? []).length === 0 && <Empty>No identity details yet.</Empty>}
			</Card>

			{/* Mentioned-in card */}
			<Card title="Mentioned in">
				{(profile.mentioned_in ?? []).length === 0 ? (
					<Empty>No documents yet.</Empty>
				) : (
					<ul className="space-y-1.5">
						{profile.mentioned_in.map((m) => (
							<li key={m.doc_id} className="flex items-center gap-2 text-sm text-slate-700">
								<FileText size={14} className="shrink-0 text-slate-400" />
								<span className="truncate">{m.label || "Document"}</span>
								{m.role && (
									<span className="ml-auto shrink-0 text-[10px] bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">
										{roleLabel(m.role)}
									</span>
								)}
							</li>
						))}
					</ul>
				)}
			</Card>

			{/* Other grounded facts */}
			{(profile.extra ?? []).length > 0 && (
				<Card title="Other">
					{profile.extra.map((f) => (
						<Row key={`${f.label}:${f.value}`} label={f.label} value={f.value} />
					))}
				</Card>
			)}
		</div>
	);
}

function StatusChip({ on, label }: { on: boolean; label: string }) {
	return (
		<span
			className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border ${
				on
					? "bg-green-50 border-green-200 text-green-700"
					: "bg-slate-50 border-slate-200 text-slate-400"
			}`}
		>
			{on ? "✓" : "○"} {label}
		</span>
	);
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<section className="rounded-xl border border-slate-200 bg-white p-4">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{title}</h3>
			<div className="space-y-1.5">{children}</div>
		</section>
	);
}

function Row({
	icon,
	label,
	value,
}: {
	icon?: React.ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="flex items-start gap-2 text-sm">
			{icon && <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>}
			<span className="shrink-0 text-slate-400 w-24">{label}</span>
			<span className="text-slate-800 break-words min-w-0">{value}</span>
		</div>
	);
}

function Empty({ children }: { children: React.ReactNode }) {
	return <p className="text-sm text-slate-400">{children}</p>;
}
