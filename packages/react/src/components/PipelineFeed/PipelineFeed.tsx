import { useEffect, useRef, useState } from "react";
import type { CaseEvent } from "@fenero/lux-core";
import styles from "./PipelineFeed.module.css";

export interface PipelineFeedProps {
	events: CaseEvent[];
	running?: boolean;
	connecting?: boolean;
	/** Override the default domain → { label } map. Class-names come from
	 *  CSS variables in the CSS module; domain variant colors are set by
	 *  consumers via the dotColor hint below. */
	domainMeta?: Record<string, { label: string; dotColor: string }>;
	className?: string;
}

const DEFAULT_DOMAINS: Record<string, { label: string; dotColor: string }> = {
	intake:     { label: "Intake",    dotColor: "#60a5fa" },
	stitch:     { label: "Stitch",    dotColor: "#c084fc" },
	extraction: { label: "Extract",   dotColor: "#fbbf24" },
	review:     { label: "Review",    dotColor: "#fb923c" },
	identify:   { label: "Identity",  dotColor: "#22d3ee" },
	banking:    { label: "Banking",   dotColor: "#2dd4bf" },
	qualify:    { label: "Qualify",   dotColor: "#4ade80" },
	case:       { label: "Case",      dotColor: "#94a3b8" },
};

function formatAction(eventType: string): string {
	return eventType.split(".").slice(1).join(" ").replace(/_/g, " ");
}

function renderFields(data: Record<string, unknown> | null): Array<[string, string]> {
	if (!data) return [];
	return Object.entries(data)
		.filter(([, v]) => {
			if (v === null || v === undefined) return false;
			if (Array.isArray(v)) return false;
			if (typeof v === "object") return false;
			return true;
		})
		.map(([k, v]) => {
			const key = k.replace(/_/g, " ");
			let val = String(v);
			if (
				typeof v === "number" &&
				(k.includes("amount") || k.includes("total") || k.includes("monthly") || k.includes("deposit"))
			) {
				val = new Intl.NumberFormat("en-US", {
					style: "currency",
					currency: "USD",
					maximumFractionDigits: 0,
				}).format(v);
			}
			return [key, val] as [string, string];
		})
		.slice(0, 6);
}

function EventCard({
	event,
	defaultOpen,
	domainMeta,
}: {
	event: CaseEvent;
	defaultOpen?: boolean;
	domainMeta: Record<string, { label: string; dotColor: string }>;
}) {
	const [open, setOpen] = useState(defaultOpen ?? false);
	const domain = event.event_type.split(".")[0] ?? "";
	const meta = domainMeta[domain] ?? { label: domain, dotColor: "#94a3b8" };
	const fields = renderFields(event.event_data);
	const time = event.created_at ? new Date(event.created_at).toLocaleTimeString() : "";
	const action = formatAction(event.event_type);
	const isTerminal =
		event.event_type === "case.system.completed" ||
		event.event_type === "qualify.completed";

	return (
		<div className={`${styles.card}${isTerminal ? ` ${styles.cardTerminal}` : ""}`}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className={`${styles.cardHeader}${isTerminal ? ` ${styles.cardHeaderTerminal}` : ""}`}
			>
				<span className={styles.domainDot} style={{ background: meta.dotColor }} />
				<div className={styles.labelRow}>
					<span className={styles.domainBadge}>{meta.label}</span>
					<span className={styles.action}>{action}</span>
				</div>
				<div className={styles.meta}>
					<span className={styles.time}>{time}</span>
					{fields.length > 0 && <span className={styles.caret}>{open ? "▲" : "▼"}</span>}
				</div>
			</button>
			{open && fields.length > 0 && (
				<div className={styles.fields}>
					{fields.map(([k, v]) => (
						<div key={k}>
							<div className={styles.fieldKey}>{k}</div>
							<div className={styles.fieldValue}>{v}</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function PipelineFeed({
	events,
	running,
	connecting,
	domainMeta = DEFAULT_DOMAINS,
	className,
}: PipelineFeedProps) {
	const bottomRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [events]);

	return (
		<div className={`${styles.root}${className ? ` ${className}` : ""}`}>
			<div className={styles.statusBar}>
				<span className={styles.title}>Pipeline</span>
				{connecting && (
					<span className={`${styles.statusLabel} ${styles.statusConnectingLabel}`}>
						<span className={`${styles.statusDot} ${styles.statusConnecting}`} />
						{" "}Connecting…
					</span>
				)}
				{running && !connecting && (
					<span className={`${styles.statusLabel} ${styles.statusLiveLabel}`}>
						<span className={`${styles.statusDot} ${styles.statusLive}`} />
						{" "}Live
					</span>
				)}
				{!running && !connecting && events.length > 0 && (
					<span className={`${styles.statusLabel} ${styles.statusIdleLabel}`}>
						{events.length} events
					</span>
				)}
			</div>

			<div className={styles.stream}>
				{events.length === 0 && (connecting || running) && (
					<div className={styles.placeholder}>
						<div className={styles.spinner} />
						<p className={styles.statusLabel}>
							{connecting ? "Connecting to pipeline…" : "Waiting for first event…"}
						</p>
					</div>
				)}
				{events.map((e, i) => (
					<EventCard
						key={e.event_id}
						event={e}
						defaultOpen={
							i === events.length - 1 &&
							(e.event_type.includes("qualify") || e.event_type.includes("completed"))
						}
						domainMeta={domainMeta}
					/>
				))}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}
