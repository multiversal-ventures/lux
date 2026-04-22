/**
 * Displays the event log during advisor analysis.
 */

import { forwardRef } from "react";
import {
	Wand2,
	FileText,
	Brain,
	Wrench,
	CheckCircle,
	AlertTriangle,
	ChevronRight,
	HelpCircle,
	TrendingUp,
	MessageCircle,
} from "lucide-react";
import type { AdvisorEvent } from "./types";

interface AdvisorEventLogProps {
	events: AdvisorEvent[];
	compact?: boolean;
}

export function getEventIcon(type: string) {
	switch (type) {
		case "start":
			return <Wand2 className="w-4 h-4 text-purple-500" />;
		case "context":
			return <FileText className="w-4 h-4 text-slate-500" />;
		case "thinking":
			return <Brain className="w-4 h-4 text-purple-500" />;
		case "tool_call":
			return <Wrench className="w-4 h-4 text-amber-500" />;
		case "tool_result":
			return <CheckCircle className="w-4 h-4 text-green-500" />;
		case "complete":
			return <Wand2 className="w-4 h-4 text-green-500" />;
		case "error":
			return <AlertTriangle className="w-4 h-4 text-red-500" />;
		case "ask_user":
			return <HelpCircle className="w-4 h-4 text-blue-500" />;
		case "propose_scenario":
			return <TrendingUp className="w-4 h-4 text-green-500" />;
		case "user_message":
			return <MessageCircle className="w-4 h-4 text-purple-500" />;
		case "assistant_message":
			return <Wand2 className="w-4 h-4 text-purple-400" />;
		default:
			return <ChevronRight className="w-4 h-4 text-slate-400" />;
	}
}

export function renderEventContent(event: AdvisorEvent) {
	const { type, data } = event;

	switch (type) {
		case "start":
			return <span className="text-slate-600">Starting analysis...</span>;
		case "context":
			return (
				<span className="text-slate-600">
					Found {(data.total_facts as number) || 0} facts across{" "}
					{((data.document_types as string[]) || []).length} document types
				</span>
			);
		case "thinking":
			return (
				<span className="text-purple-700">
					<span className="font-medium">Step {data.step as number}:</span> {data.thinking as string}
				</span>
			);
		case "tool_call":
			return (
				<span className="text-amber-700">
					Calling <code className="bg-amber-100 px-1 rounded">{data.tool as string}</code>
				</span>
			);
		case "tool_result": {
			const success = data.success as boolean;
			const output = data.output as Record<string, unknown> | undefined;
			const error = data.error as string | undefined;

			// Build summary of what was returned
			let summary = "";
			if (output) {
				if (output.documents && Array.isArray(output.documents)) {
					summary = `${(output.documents as unknown[]).length} docs`;
				} else if (output.facts && Array.isArray(output.facts)) {
					summary = `${(output.facts as unknown[]).length} facts`;
				} else if (output.approaches && Array.isArray(output.approaches)) {
					summary = `${(output.approaches as unknown[]).length} approaches`;
				} else if (output.borrowers && Array.isArray(output.borrowers)) {
					summary = `${(output.borrowers as unknown[]).length} borrowers`;
				} else if (output.estimate !== undefined) {
					summary = `$${Number(output.monthly_income || 0).toLocaleString()}/mo`;
				} else if (typeof output === "object") {
					const keys = Object.keys(output);
					summary = keys.slice(0, 3).join(", ");
				}
			}

			return (
				<span className={success ? "text-green-700" : "text-red-600"}>
					<code className={`${success ? "bg-green-100" : "bg-red-100"} px-1 rounded`}>
						{data.tool as string}
					</code>{" "}
					{success ? "completed" : "failed"}
					{data.truncated ? ` (${String(data.total_items)} items)` : null}
					{success && summary && <span className="text-slate-500 ml-1">→ {summary}</span>}
					{!success && error && <span className="text-red-500 ml-1">: {error}</span>}
				</span>
			);
		}
		case "error":
			return <span className="text-red-600">{data.message as string}</span>;
		case "ask_user":
			return (
				<span className="text-blue-600">
					<span className="font-medium">Question:</span> {data.question as string}
				</span>
			);
		case "propose_scenario":
			return (
				<span className="text-green-600">
					<span className="font-medium">Proposed:</span> {data.name as string}
				</span>
			);
		case "user_message":
			return (
				<span className="text-purple-700">
					<span className="font-medium">You:</span> {data.content as string}
				</span>
			);
		case "assistant_message":
			return (
				<span className="text-slate-600">
					<span className="font-medium">Advisor:</span> {data.content as string}
				</span>
			);
		case "complete":
			return <span className="text-green-600">Analysis complete.</span>;
		default:
			return <span className="text-slate-500">{JSON.stringify(data)}</span>;
	}
}

export const AdvisorEventLog = forwardRef<HTMLDivElement, AdvisorEventLogProps>(
	function AdvisorEventLog({ events, compact = false }, ref) {
		if (events.length === 0) return null;

		const displayEvents = compact ? events.slice(-5) : events;

		return (
			<div
				className={`bg-slate-50 rounded-lg p-${compact ? "3" : "4"} ${compact ? "" : "max-h-64"} overflow-y-auto`}
			>
				<div className={`space-y-${compact ? "1" : "2"} text-${compact ? "xs" : "sm"}`}>
					{displayEvents.map((event, i) => (
						<div key={i} className={`flex items-start gap-2 ${compact ? "text-slate-500" : ""}`}>
							{getEventIcon(event.type)}
							<div className="flex-1">{renderEventContent(event)}</div>
						</div>
					))}
					<div ref={ref} />
				</div>
			</div>
		);
	},
);

export default AdvisorEventLog;
