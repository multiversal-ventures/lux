import { ChevronRight, FileText, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import type { PartyProfile } from "../../hooks/usePartyHub.js";
import { identifierTypeLabel, roleLabel } from "../../labels.js";
import type { PartyMentionRef } from "./PartyHub.js";

/** "What we know about this party" — the operator profile panel.
 *
 * OPERATOR-facing: identifiers are MASKED (tail only, e.g. "SSN ••• 1234").
 * The full SSN/EIN never reaches the client, so there is nothing here to
 * unmask. COMPACT: this renders inline-expanded inside the ~260px party-list
 * sidebar (not a center pane), so the avatar is small, cards are tight, and
 * long values (emails, addresses) wrap/truncate rather than overflow. */
export function PartyProfilePanel({
	profile,
	onOpenDocument,
}: {
	profile: PartyProfile;
	/** When set, "Mentioned in" rows carrying a `file_id` become clickable and
	 * call this with the mention so the host can open the document viewer. */
	onOpenDocument?: (mention: PartyMentionRef) => void;
}) {
	const maskedIdentifier =
		profile.identifier?.last4 && profile.identifier?.type
			? `${identifierTypeLabel(profile.identifier.type)} ••• ${profile.identifier.last4}`
			: null;

	// No header here — the party-list row above this panel already shows the
	// avatar + name + role + id, so repeating it would duplicate. This panel
	// starts at the status chips.
	return (
		<div className="space-y-2.5">
			{/* Status chips — wrap when narrow */}
			<div className="flex flex-wrap gap-1.5">
				<StatusChip on={!!profile.status?.verified} label="Verified" />
				<StatusChip on={!!profile.status?.signed} label="Signed" />
				<StatusChip on={!!profile.status?.has_account} label="Account" />
			</div>

			{/* Identity card */}
			<Card title="Identity">
				{maskedIdentifier && (
					<Row icon={<ShieldCheck size={13} />} label="Identifier" value={maskedIdentifier} />
				)}
				{profile.email && <Row icon={<Mail size={13} />} label="Email" value={profile.email} />}
				{(profile.phones ?? []).map((p) => (
					<Row key={p} icon={<Phone size={13} />} label="Phone" value={p} />
				))}
				{(profile.addresses ?? []).map((a) => (
					<Row key={a} icon={<MapPin size={13} />} label="Address" value={a} />
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
					<ul className="space-y-1">
						{profile.mentioned_in.map((m) => {
							const clickable = !!onOpenDocument && !!m.file_id;
							const roleChip = m.role ? (
								<span className="ml-auto shrink-0 text-[10px] bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5">
									{roleLabel(m.role)}
								</span>
							) : null;
							if (clickable) {
								return (
									<li key={m.doc_id}>
										<button
											type="button"
											onClick={() =>
												onOpenDocument?.({
													doc_id: m.doc_id,
													label: m.label || "Document",
													file_id: m.file_id,
													page: m.page,
													bbox: m.bbox,
												})
											}
											title="Open this document"
											className="group flex w-full items-center gap-1.5 text-xs text-slate-700 hover:text-indigo-700"
										>
											<FileText size={13} className="shrink-0 text-slate-400 group-hover:text-indigo-500" />
											<span className="truncate min-w-0 group-hover:underline">{m.label || "Document"}</span>
											{roleChip}
											<ChevronRight size={13} className="shrink-0 text-slate-300 group-hover:text-indigo-500" />
										</button>
									</li>
								);
							}
							return (
								<li key={m.doc_id} className="flex items-center gap-1.5 text-xs text-slate-700">
									<FileText size={13} className="shrink-0 text-slate-400" />
									<span className="truncate min-w-0">{m.label || "Document"}</span>
									{roleChip}
								</li>
							);
						})}
					</ul>
				)}
			</Card>

			{/* Uploaded-docs card: files uploaded in THIS party's chat only. */}
			{(profile.uploaded_docs ?? []).length > 0 && (
				<Card title="Uploaded docs">
					<ul className="space-y-1">
						{profile.uploaded_docs.map((d) => {
							const clickable = !!onOpenDocument && !!d.file_id && !!d.doc_id && !d.processing;
							if (clickable) {
								return (
									<li key={d.file_id ?? d.label}>
										<button
											type="button"
											onClick={() =>
												onOpenDocument?.({
													doc_id: d.doc_id,
													label: d.label || "Uploaded document",
													file_id: d.file_id,
												})
											}
											title="Open this uploaded document"
											className="group flex w-full items-center gap-1.5 text-xs text-slate-700 hover:text-indigo-700"
										>
											<FileText size={13} className="shrink-0 text-slate-400 group-hover:text-indigo-500" />
											<span className="truncate min-w-0 group-hover:underline">{d.label || "Uploaded document"}</span>
											<ChevronRight size={13} className="ml-auto shrink-0 text-slate-300 group-hover:text-indigo-500" />
										</button>
									</li>
								);
							}
							return (
								<li key={d.file_id ?? d.label} className="flex items-center gap-1.5 text-xs text-slate-700">
									<FileText size={13} className="shrink-0 text-slate-400" />
									<span className="truncate min-w-0">{d.label || "Uploaded document"}</span>
									{d.processing && (
										<span className="ml-auto shrink-0 text-[10px] bg-amber-50 text-amber-700 rounded px-1.5 py-0.5">
											Processing
										</span>
									)}
								</li>
							);
						})}
					</ul>
				</Card>
			)}

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
			className={`inline-flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border ${
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
		<section className="rounded-lg border border-slate-200 bg-white p-2.5">
			<h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">
				{title}
			</h3>
			<div className="space-y-1">{children}</div>
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
		<div className="flex items-start gap-1.5 text-xs">
			{icon && <span className="mt-0.5 shrink-0 text-slate-400">{icon}</span>}
			<span className="shrink-0 text-slate-400 w-14">{label}</span>
			<span className="text-slate-800 break-words min-w-0 flex-1">{value}</span>
		</div>
	);
}

function Empty({ children }: { children: React.ReactNode }) {
	return <p className="text-sm text-slate-400">{children}</p>;
}
