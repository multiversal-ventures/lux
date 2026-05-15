import { useState } from "react";
import type { CaseEvent, SpecAuditResponse } from "@multiversal-ventures/lux-core";
import styles from "./AuditTrail.module.css";

export interface AuditTrailProps {
	caseId: string;
	events: CaseEvent[];
	specs: SpecAuditResponse[];
	loading?: boolean;
	initialTab?: "events" | "specs";
	className?: string;
}

function formatEventFields(
	data: Record<string, unknown> | null,
): Array<[string, string]> {
	if (!data) return [];
	return Object.entries(data)
		.filter(([, v]) => typeof v !== "object" || v === null)
		.map(([k, v]) => [k, String(v)]);
}

function EventLog({ events, caseId }: { events: CaseEvent[]; caseId: string }) {
	return (
		<div className={styles.eventList}>
			<p className={styles.eventMeta}>
				Case: {caseId} · Events: {events.length}
			</p>
			{events.map((e) => {
				const fields = formatEventFields(e.event_data);
				return (
					<div key={e.event_id} className={styles.eventCard}>
						<div className={styles.eventHeader}>
							<span className={styles.eventIdCol}>
								#{String(e.event_id).padStart(4, "0")}
							</span>
							<span className={styles.eventIdCol}>
								{e.created_at ? new Date(e.created_at).toLocaleTimeString() : ""}
							</span>
							<span className={styles.eventType}>{e.event_type}</span>
						</div>
						{fields.length > 0 && (
							<div className={styles.eventFields}>
								{fields.map(([k, v]) => (
									<div key={k} style={{ display: "flex", gap: 8, minWidth: 0 }}>
										<span className={styles.eventIdCol}>{k}:</span>
										<span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{v}</span>
									</div>
								))}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

function SpecsLog({ specs }: { specs: SpecAuditResponse[] }) {
	const [open, setOpen] = useState<string | null>(specs[0]?.spec_name ?? null);

	return (
		<div className={styles.specList}>
			{specs.map((spec) => {
				const isOpen = open === spec.spec_name;
				const passed =
					spec.outcome !== "fail" && (spec.monthly_amount ?? 0) > 0;
				return (
					<div key={spec.spec_name} className={styles.spec}>
						<button
							type="button"
							className={styles.specHeader}
							onClick={() => setOpen(isOpen ? null : spec.spec_name)}
						>
							<span className={styles.specName}>{spec.spec_name}</span>
							<span style={{ display: "flex", gap: 12, alignItems: "center" }}>
								{spec.monthly_amount != null && spec.monthly_amount > 0 && (
									<span className={styles.specAmount}>
										${spec.monthly_amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}/mo
									</span>
								)}
								<span
									className={`${styles.outcomeChip} ${passed ? styles.outcomePass : styles.outcomeFail}`}
								>
									{spec.outcome ?? "—"}
								</span>
								<span>{isOpen ? "▲" : "▼"}</span>
							</span>
						</button>

						{isOpen && (
							<div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
								{spec.steps && spec.steps.length > 0 && (
									<table className={styles.stepsTable}>
										<thead>
											<tr>
												<th>step</th>
												<th>name</th>
												<th>formula</th>
												<th className={styles.resultCol}>result</th>
											</tr>
										</thead>
										<tbody>
											{spec.steps.map((s) => (
												<tr key={s.step_number} data-final={s.is_final ? "true" : "false"}>
													<td style={{ color: "var(--color-text-subtle)" }}>{s.step_number}</td>
													<td>{s.derivation_name}</td>
													<td style={{ color: "var(--color-text-muted)", maxWidth: "16rem", overflow: "hidden", textOverflow: "ellipsis" }}>
														{s.formula_display ?? s.formula}
													</td>
													<td className={styles.resultCol}>
														{s.result != null ? s.result.toLocaleString() : "—"}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}

export function AuditTrail({
	caseId,
	events,
	specs,
	loading,
	initialTab = "events",
	className,
}: AuditTrailProps) {
	const [tab, setTab] = useState<"events" | "specs">(initialTab);
	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			<div className={styles.header}>
				<span className={styles.title}>Audit Trail</span>
				<button
					type="button"
					onClick={() => setTab("events")}
					className={`${styles.tab}${tab === "events" ? ` ${styles.tabActive}` : ""}`}
				>
					Event Log
				</button>
				<button
					type="button"
					onClick={() => setTab("specs")}
					className={`${styles.tab}${tab === "specs" ? ` ${styles.tabActive}` : ""}`}
				>
					Specs ({specs.length})
				</button>
			</div>
			<div className={styles.body}>
				{loading && <p>Loading audit trail…</p>}
				{!loading && tab === "events" && <EventLog events={events} caseId={caseId} />}
				{!loading && tab === "specs" && <SpecsLog specs={specs} />}
			</div>
		</div>
	);
}
