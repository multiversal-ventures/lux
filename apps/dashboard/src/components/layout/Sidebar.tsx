import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../../store";
import { collapseSidebarForView, toggleSidebar } from "../../store/appSlice";
import type { CaseStatus, SourceRef, StreamEvent, StreamStatus } from "../../types";
import { WorkflowEvents } from "../sidebar/WorkflowEvents";

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(relativeTime);

interface SidebarProps {
	events: StreamEvent[];
	status: CaseStatus | null;
	/** Stream connection status - passed from useGunnrCase hook */
	streamStatus: StreamStatus;
	onSourceClick?: (source: SourceRef) => void;
}

export function Sidebar({ events, onSourceClick }: SidebarProps) {
	const dispatch = useAppDispatch();
	const collapsed = useAppSelector((state) => state.app.sidebarCollapsed);
	const [filter, setFilter] = useState<"issues" | "info">("issues");
	const [tabUserSelected, setTabUserSelected] = useState(false);
	const location = useLocation();
	const { caseId } = useParams<{ caseId: string }>();
	const isIncomeTab = location.pathname.includes("/income");

	// When case changes or Sidebar mounts: on main case routes (view, scenario, income, extraction) keep panel collapsed; otherwise reset for auto-expand
	useEffect(() => {
		setTabUserSelected(false);
		const path = location.pathname;
		const base = caseId ? `/case/${caseId}` : "";
		const onMainRoute =
			base &&
			(path === `${base}/view` ||
				path === `${base}/new-scenario` ||
				path === `${base}/income` ||
				path === base ||
				path === `${base}/`);
		if (onMainRoute) {
			dispatch(collapseSidebarForView());
		}
	}, [caseId, location.pathname, dispatch]);

	// Calculate event counts early (needed for auto-collapse and tab selection)
	const phaseFilteredEventsForCount = events.filter((e) => {
		if (isIncomeTab) return e.phase === "income_calculation";
		return e.phase !== "income_calculation";
	});
	const issuesCount = phaseFilteredEventsForCount.filter((e) => e.type === "issue").length;
	const infoCount = phaseFilteredEventsForCount.filter((e) => e.type !== "issue").length;

	// Auto-select tab: show Issues if any, otherwise show Info (until user manually selects)
	useEffect(() => {
		if (!tabUserSelected) {
			if (issuesCount > 0) {
				setFilter("issues");
			} else if (infoCount > 0) {
				setFilter("info");
			}
		}
	}, [issuesCount, infoCount, tabUserSelected]);

	useEffect(() => {
		setTabUserSelected(false);
	}, [isIncomeTab]);

	if (collapsed) {
		return (
			<aside className="w-12 bg-white border-l border-slate-200 flex flex-col items-center py-4">
				<button
					onClick={() => dispatch(toggleSidebar())}
					className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
					title="Expand sidebar"
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
						/>
					</svg>
				</button>
			</aside>
		);
	}

	// Reuse the already-computed phase-filtered events
	const phaseFilteredEvents = phaseFilteredEventsForCount;

	// Filter events based on active filter (after phase filtering)
	const filteredEvents =
		filter === "issues"
			? phaseFilteredEvents.filter((e) => e.type === "issue")
			: phaseFilteredEvents.filter((e) => e.type !== "issue");

	return (
		<aside className="w-80 bg-white border-l border-slate-200 flex flex-col h-full">
			{/* Header - uses same results-tab class as TabNav for perfect alignment */}
			<nav className="flex items-center border-b border-slate-200 bg-white px-4">
				<div className="flex flex-1">
					<button
						onClick={() => {
							setFilter("issues");
							setTabUserSelected(true);
						}}
						className={`results-tab cursor-pointer ${filter === "issues" ? "active" : ""}`}
					>
						Agent Log{" "}
						<span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
							{issuesCount}
						</span>
					</button>
					<button
						onClick={() => {
							setFilter("info");
							setTabUserSelected(true);
						}}
						className={`results-tab cursor-pointer ${filter === "info" ? "active" : ""}`}
					>
						Info{" "}
						<span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
							{infoCount}
						</span>
					</button>
				</div>
				<button
					onClick={() => dispatch(toggleSidebar())}
					className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 cursor-pointer"
					title="Collapse sidebar"
				>
					<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M13 5l7 7-7 7M5 5l7 7-7 7"
						/>
					</svg>
				</button>
			</nav>
			<WorkflowEvents events={filteredEvents} onSourceClick={onSourceClick} />
		</aside>
	);
}
