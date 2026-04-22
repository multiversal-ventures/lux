import { memo, useMemo } from "react";
import type { StreamEvent, SourceRef } from "../../types";

interface WorkflowEventsProps {
	events: StreamEvent[];
	onSourceClick?: (source: SourceRef) => void;
}

type Severity = "error" | "warning" | "info";

const severityOrder: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

function getSeverity(event: StreamEvent): Severity {
	return (event.data?.severity as Severity) ?? (event.rule?.severity as Severity) ?? "info";
}

/**
 * Minimal list display of workflow events.
 * Renders nothing when there are no events.
 */
export const WorkflowEvents = memo(function WorkflowEvents({
	events,
	onSourceClick,
}: WorkflowEventsProps) {
	const sortedEvents = useMemo(() => {
		if (events.length === 0 || events[0].type !== "issue") {
			return [...events].reverse();
		}
		return [...events].sort(
			(a, b) => severityOrder[getSeverity(a)] - severityOrder[getSeverity(b)],
		);
	}, [events]);

	if (sortedEvents.length === 0) {
		return null;
	}

	return (
		<div className="px-3 py-2 flex-1 overflow-y-auto">
			{sortedEvents.map((event) => (
				<EventRow key={event.id} event={event} onSourceClick={onSourceClick} />
			))}
		</div>
	);
});

interface EventRowProps {
	event: StreamEvent;
	onSourceClick?: (source: SourceRef) => void;
}

const EventRow = memo(function EventRow({ event, onSourceClick }: EventRowProps) {
	const sourceText = getSourceText(event.source);

	const handleSourceClick = () => {
		if (event.source && onSourceClick) {
			onSourceClick(event.source);
		}
	};

	return (
		<div className="pt-1 pb-2 border-b border-slate-100 last:border-0">
			<EventBadge event={event} />
			<p
				className={`text-sm leading-snug ${
					event.type === "issue" ? "text-slate-700" : "text-slate-700"
				}`}
			>
				{event.type === "issue" ? event.message : lowercaseFirst(event.message)}
			</p>
			{sourceText && (
				<div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
					<button
						onClick={handleSourceClick}
						className="hover:text-slate-600 hover:underline cursor-pointer"
					>
						{sourceText}
					</button>
				</div>
			)}
		</div>
	);
});

function EventBadge({ event }: { event: StreamEvent }) {
	// Only show badge for events with type === 'issue'
	if (event.type !== "issue") {
		return null;
	}

	const severity = getSeverity(event);
	const styles: Record<Severity, string> = {
		error: "text-red-600 border-red-300",
		warning: "text-amber-600 border-amber-300",
		info: "text-blue-600 border-blue-300",
	};

	return (
		<span
			className={`inline-block px-2 py-0.5 mb-1.5 text-xs font-medium border rounded-sm ${styles[severity]}`}
		>
			{severity}
		</span>
	);
}

function getSourceText(source?: SourceRef): string | null {
	if (!source) return null;
	const { document_class, page_number, filename } = source;
	if (document_class && page_number) {
		return `${document_class} p.${page_number}`;
	}
	if (filename && page_number) {
		return `${filename} p.${page_number}`;
	}
	if (page_number) {
		return `Page ${page_number}`;
	}
	return null;
}

function lowercaseFirst(str: string): string {
	if (!str) return str;
	return str.charAt(0).toLowerCase() + str.slice(1);
}

export default WorkflowEvents;
