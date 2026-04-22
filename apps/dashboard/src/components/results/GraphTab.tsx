import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useAuth } from "../../hooks";
import { useCaseGraph } from "../../hooks/useCaseQueries";
import { trackSearch } from "../../lib/mixpanel";

// =============================================================================
// Types
// =============================================================================

interface GraphNode {
	id: string;
	label: string;
	properties: Record<string, unknown>;
}

interface GraphEdge {
	source: string;
	target: string;
	type: string;
	properties: Record<string, unknown>;
}

interface GraphStats {
	total_nodes: number;
	total_edges: number;
	nodes_by_type: Record<string, number>;
	edges_by_type: Record<string, number>;
}

interface ReviewItem {
	rule: string;
	severity: string;
	message: string;
	details: Record<string, unknown>;
}

interface GraphFilters {
	search: string;
	year: string;
	limit: number;
	nodeTypes: string[];
}

// =============================================================================
// Constants
// =============================================================================

const NODE_COLORS: Record<string, string> = {
	// Core hierarchy
	Case: "#3b82f6", // blue-500
	Snapshot: "#60a5fa", // blue-400
	File: "#8b5cf6", // violet-500
	Page: "#6366f1", // indigo-500
	Document: "#10b981", // emerald-500
	// Fields/Facts
	Field: "#f59e0b", // amber-500
	Fact: "#fbbf24", // amber-400
	// Identity/Party
	Identity: "#ec4899", // pink-500
	Party: "#f472b6", // pink-400
	Mention: "#f97316", // orange-500
	FinancialEntity: "#06b6d4", // cyan-500
	// Evidence & Validation
	Evidence: "#14b8a6", // teal-500
	Validation: "#ef4444", // red-500
	IntraDocValidation: "#f87171", // red-400
	CrossDocValidation: "#fca5a5", // red-300
	DocumentType: "#94a3b8", // slate-400
	default: "#64748b", // slate-500
};

const DEFAULT_FILTERS: GraphFilters = {
	search: "",
	year: "all",
	limit: 100,
	nodeTypes: [],
};

const ALL_NODE_TYPES = [
	"Case",
	"File",
	"Page",
	"Document",
	"Field",
	"Fact",
	"Identity",
	"Party",
	"Mention",
	"FinancialEntity",
	"Evidence",
	"Validation",
];

// =============================================================================
// Main Component
// =============================================================================

interface GraphTabProps {
	caseId: string;
}

export function GraphTab({ caseId }: GraphTabProps) {
	const { user } = useAuth();
	const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
	const [filters, setFilters] = useState<GraphFilters>(DEFAULT_FILTERS);
	const graphQuery = useCaseGraph(
		caseId,
		{
			search: filters.search,
			year: filters.year,
			limit: filters.limit,
			nodeTypes: filters.nodeTypes,
		},
		{ enabled: !!caseId },
	);
	const graphData = graphQuery.data ?? null;
	const loading = graphQuery.isLoading;
	const error = graphQuery.error instanceof Error ? graphQuery.error.message : null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const graphRef = useRef<ForceGraphMethods<any, any>>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

	// Track container dimensions - must wait for layout
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const updateDimensions = () => {
			// Use clientWidth/Height which excludes borders/scrollbars
			setDimensions({
				width: container.clientWidth,
				height: container.clientHeight,
			});
		};

		// Delay initial measurement to ensure layout is complete
		const timer = setTimeout(updateDimensions, 50);

		// Resize observer for dynamic updates
		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
		});
		resizeObserver.observe(container);

		return () => {
			clearTimeout(timer);
			resizeObserver.disconnect();
		};
	}, []);

	// Track searches when results load for non-trivial queries.
	useEffect(() => {
		if (!graphData) return;
		if (filters.search.trim().length < 2) return;
		trackSearch({
			search_query: filters.search.trim(),
			user_id: user?.uid,
			results_count: graphData.nodes.length,
		});
	}, [graphData, filters.search, user?.uid]);

	// Escape to close panel
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setSelectedNode(null);
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Extract available years from data
	const availableYears = useMemo(() => {
		if (!graphData) return [];
		const years = new Set<string>();
		graphData.nodes.forEach((n) => {
			const period = n.properties.effective_period;
			const taxYear = n.properties.tax_year;
			if (period) years.add(String(period));
			if (taxYear) years.add(String(taxYear));
		});
		return Array.from(years)
			.filter((y) => /^\d{4}$/.test(y))
			.sort()
			.reverse();
	}, [graphData]);

	// Transform data for force-graph
	const forceGraphData = useMemo(() => {
		if (!graphData) return { nodes: [], links: [] };

		const nodeMap = new Map(graphData.nodes.map((n) => [n.id, n]));

		return {
			nodes: graphData.nodes.map((n) => ({
				id: n.id,
				label: n.label,
				properties: n.properties,
				// Size based on connections
				val: 1,
			})),
			links: graphData.edges
				.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
				.map((e) => ({
					source: e.source,
					target: e.target,
					type: e.type,
				})),
		};
	}, [graphData]);

	// Node click handler - select and center on node
	const handleNodeClick = useCallback(
		(node: {
			id: string;
			label: string;
			properties: Record<string, unknown>;
			x?: number;
			y?: number;
		}) => {
			const graphNode = graphData?.nodes.find((n) => n.id === node.id);
			if (graphNode) {
				setSelectedNode(graphNode);
				// Center on clicked node with zoom
				if (graphRef.current && node.x !== undefined && node.y !== undefined) {
					graphRef.current.centerAt(node.x, node.y, 300);
				}
			}
		},
		[graphData],
	);

	// Navigate to node (from metadata panel) - select and center
	const handleNavigateToNode = useCallback(
		(nodeId: string) => {
			const node = graphData?.nodes.find((n) => n.id === nodeId);
			if (node) {
				setSelectedNode(node);
				// Center the graph on this node
				if (graphRef.current) {
					const nodeObj = forceGraphData.nodes.find((n) => n.id === nodeId);
					if (nodeObj) {
						const x = (nodeObj as unknown as { x: number }).x;
						const y = (nodeObj as unknown as { y: number }).y;
						graphRef.current.centerAt(x, y, 500);
					}
				}
			}
		},
		[graphData, forceGraphData],
	);

	// Get connected node IDs when a node is selected
	const connectedNodeIds = useMemo(() => {
		if (!selectedNode || !graphData) return null;
		const connected = new Set<string>([selectedNode.id]);
		graphData.edges.forEach((e) => {
			if (e.source === selectedNode.id) connected.add(e.target);
			if (e.target === selectedNode.id) connected.add(e.source);
		});
		return connected;
	}, [selectedNode, graphData]);

	// Custom node canvas rendering - Case node is larger, grey out non-connected when selected
	const nodeCanvasObject = useCallback(
		(
			node: { id: string; label: string; x?: number; y?: number },
			ctx: CanvasRenderingContext2D,
			globalScale: number,
		) => {
			if (node.x === undefined || node.y === undefined) return;

			const isCase = node.label === "Case";
			const isSelected = selectedNode?.id === node.id;
			const isConnected = !connectedNodeIds || connectedNodeIds.has(node.id);
			const baseSize = isCase ? 12 : 5;
			const baseColor = NODE_COLORS[node.label] || NODE_COLORS.default;

			// Grey out non-connected nodes when something is selected
			const color = isConnected ? baseColor : "#e2e8f0";
			const opacity = isConnected ? 1 : 0.4;

			ctx.globalAlpha = opacity;

			// Draw outer ring for Case node
			if (isCase && isConnected) {
				ctx.beginPath();
				ctx.arc(node.x, node.y, baseSize + 4, 0, 2 * Math.PI);
				ctx.strokeStyle = "#1e40af";
				ctx.lineWidth = 2;
				ctx.stroke();
			}

			// Draw node circle
			ctx.beginPath();
			ctx.arc(node.x, node.y, baseSize, 0, 2 * Math.PI);
			ctx.fillStyle = color;
			ctx.fill();

			// Draw selection ring
			if (isSelected) {
				ctx.globalAlpha = 1;
				ctx.beginPath();
				ctx.arc(node.x, node.y, baseSize + 3, 0, 2 * Math.PI);
				ctx.strokeStyle = "#3b82f6";
				ctx.lineWidth = 3;
				ctx.stroke();
			}

			// Draw label for Case node always, connected nodes when zoomed
			if ((isCase || globalScale > 1.5) && isConnected) {
				ctx.globalAlpha = 1;
				const fontSize = isCase ? 14 / globalScale : 10 / globalScale;
				ctx.font = `${isCase ? "bold " : ""}${fontSize}px Sans-Serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillStyle = isCase ? "#1e40af" : "#475569";
				ctx.fillText(isCase ? "CASE" : node.label, node.x, node.y + baseSize + fontSize);
			}

			ctx.globalAlpha = 1;
		},
		[selectedNode, connectedNodeIds],
	);

	// Node pointer area for click detection
	const nodePointerAreaPaint = useCallback(
		(
			node: { label: string; x?: number; y?: number },
			color: string,
			ctx: CanvasRenderingContext2D,
		) => {
			if (node.x === undefined || node.y === undefined) return;
			const isCase = node.label === "Case";
			const size = isCase ? 16 : 7;
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
			ctx.fill();
		},
		[],
	);

	// Node hover tooltip
	const nodeLabel = useCallback(
		(node: { id: string; label: string; properties: Record<string, unknown> }) => {
			const name = getNodeDisplayName(node);
			return `${node.label}: ${name}`;
		},
		[],
	);

	// Link color - highlight connected, grey out others
	const linkColor = useCallback(
		(link: { source: string | { id: string }; target: string | { id: string } }) => {
			if (!connectedNodeIds) return "#94a3b8";
			const sourceId = typeof link.source === "object" ? link.source.id : link.source;
			const targetId = typeof link.target === "object" ? link.target.id : link.target;
			const isConnected = connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId);
			return isConnected ? "#3b82f6" : "#e2e8f0";
		},
		[connectedNodeIds],
	);

	// Link width - thicker for connected
	const linkWidth = useCallback(
		(link: { source: string | { id: string }; target: string | { id: string } }) => {
			if (!connectedNodeIds) return 1;
			const sourceId = typeof link.source === "object" ? link.source.id : link.source;
			const targetId = typeof link.target === "object" ? link.target.id : link.target;
			const isConnected = connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId);
			return isConnected ? 2 : 0.5;
		},
		[connectedNodeIds],
	);

	// Fit graph to view and center after simulation stops
	const handleEngineStop = useCallback(() => {
		// Small delay to ensure layout is fully settled
		setTimeout(() => {
			if (graphRef.current) {
				graphRef.current.zoomToFit(400, 50);
			}
		}, 100);
	}, []);

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center p-6">
					<div className="text-red-500 text-lg mb-2">Failed to load graph</div>
					<div className="text-slate-500 text-sm">{error}</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex flex-col bg-white">
			{/* Filter toolbar */}
			<FilterToolbar
				filters={filters}
				onChange={setFilters}
				availableYears={availableYears}
				truncated={graphData?.truncated}
				displayedNodes={graphData?.nodes.length}
				totalNodes={graphData?.stats.total_nodes}
				onFocusCase={() => {
					// Clear selection first to show full graph
					setSelectedNode(null);
					// Fit entire graph to view, centered
					setTimeout(() => {
						if (graphRef.current) {
							graphRef.current.zoomToFit(400, 50);
						}
					}, 50);
				}}
			/>

			<div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-50">
				{loading || !dimensions ? (
					<div className="flex items-center justify-center h-full">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
					</div>
				) : (
					<ForceGraph2D
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						ref={graphRef as any}
						graphData={forceGraphData}
						width={dimensions.width}
						height={dimensions.height}
						nodeCanvasObject={nodeCanvasObject}
						nodePointerAreaPaint={nodePointerAreaPaint}
						nodeLabel={nodeLabel}
						onNodeClick={handleNodeClick}
						linkColor={linkColor}
						linkWidth={linkWidth}
						linkDirectionalArrowLength={4}
						linkDirectionalArrowRelPos={1}
						backgroundColor="#f8fafc"
						cooldownTicks={100}
						onEngineStop={handleEngineStop}
						onBackgroundClick={() => setSelectedNode(null)}
					/>
				)}

				{/* Floating metadata panel */}
				{selectedNode && graphData && (
					<MetadataPanel
						node={selectedNode}
						edges={graphData.edges}
						reviewItems={graphData.review_items}
						onClose={() => setSelectedNode(null)}
						onNavigateToNode={handleNavigateToNode}
					/>
				)}

				{/* Legend - bottom left */}
				{graphData && <Legend stats={graphData.stats} />}
			</div>
		</div>
	);
}

// =============================================================================
// Filter Toolbar
// =============================================================================

interface FilterToolbarProps {
	filters: GraphFilters;
	onChange: (filters: GraphFilters) => void;
	availableYears: string[];
	truncated?: boolean;
	displayedNodes?: number;
	totalNodes?: number;
	onFocusCase?: () => void;
}

function FilterToolbar({
	filters,
	onChange,
	availableYears,
	truncated,
	displayedNodes,
	totalNodes,
	onFocusCase,
}: FilterToolbarProps) {
	const [searchInput, setSearchInput] = useState(filters.search);

	// Debounce search - 600ms to avoid hammering the API during typing
	// Also require minimum 2 characters to trigger search
	useEffect(() => {
		const timer = setTimeout(() => {
			const trimmed = searchInput.trim();
			const shouldSearch = trimmed.length === 0 || trimmed.length >= 2;
			if (shouldSearch && trimmed !== filters.search) {
				onChange({ ...filters, search: trimmed });
			}
		}, 600);
		return () => clearTimeout(timer);
	}, [searchInput, filters, onChange]);

	return (
		<div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200">
			{/* Search */}
			<div className="flex-1 max-w-sm relative group">
				<input
					type="text"
					placeholder="Search doc class, field names, values..."
					value={searchInput}
					onChange={(e) => setSearchInput(e.target.value)}
					className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-7"
				/>
				<div className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-help">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						className="w-4 h-4"
					>
						<path
							fillRule="evenodd"
							d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
				{/* Tooltip */}
				<div className="absolute left-0 top-full mt-1 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 w-64 shadow-lg z-20 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity pointer-events-none">
					<div className="font-medium mb-1">Full-text search across:</div>
					<ul className="space-y-0.5 text-slate-300">
						<li>• Document class (e.g., "IRS1040", "W2")</li>
						<li>• Field names (e.g., "total_income")</li>
						<li>• Field values (e.g., "125000")</li>
						<li>• File names, party names</li>
					</ul>
				</div>
			</div>

			{/* Year filter */}
			<select
				value={filters.year}
				onChange={(e) => onChange({ ...filters, year: e.target.value })}
				className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white cursor-pointer"
			>
				<option value="all">All Years</option>
				{availableYears.map((year) => (
					<option key={year} value={year}>
						{year}
					</option>
				))}
			</select>

			{/* Limit */}
			<select
				value={filters.limit}
				onChange={(e) => onChange({ ...filters, limit: Number(e.target.value) })}
				className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white cursor-pointer"
			>
				<option value={50}>50 nodes</option>
				<option value={100}>100 nodes</option>
				<option value={250}>250 nodes</option>
				<option value={500}>500 nodes</option>
				<option value={1000}>1,000 nodes</option>
				<option value={2500}>2,500 nodes</option>
				<option value={5000}>5,000 nodes</option>
				<option value={10000}>10,000 nodes</option>
			</select>

			{/* Node type filter */}
			<NodeTypeFilter
				selected={filters.nodeTypes}
				onChange={(types) => onChange({ ...filters, nodeTypes: types })}
			/>

			{/* Truncation warning */}
			{truncated && (
				<div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
					<span>⚠</span>
					<span>Limited to {filters.limit} nodes</span>
				</div>
			)}

			{/* Node count */}
			{displayedNodes !== undefined && (
				<div className="text-xs text-slate-500">
					{displayedNodes}
					{totalNodes && totalNodes > displayedNodes ? ` / ${totalNodes}` : ""} nodes
				</div>
			)}

			{/* Focus Case */}
			{onFocusCase && (
				<button
					onClick={onFocusCase}
					className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded cursor-pointer"
				>
					Focus Case
				</button>
			)}

			{/* Reset */}
			<button
				onClick={() => {
					setSearchInput("");
					onChange(DEFAULT_FILTERS);
				}}
				className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
			>
				Reset
			</button>
		</div>
	);
}

// =============================================================================
// Node Type Filter
// =============================================================================

interface NodeTypeFilterProps {
	selected: string[];
	onChange: (types: string[]) => void;
}

function NodeTypeFilter({ selected, onChange }: NodeTypeFilterProps) {
	const [open, setOpen] = useState(false);

	return (
		<div className="relative">
			<button
				onClick={() => setOpen(!open)}
				className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white cursor-pointer hover:bg-slate-50"
			>
				Types {selected.length > 0 && `(${selected.length})`}
			</button>

			{open && (
				<>
					<div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
					<div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 p-2 w-48">
						{ALL_NODE_TYPES.map((type) => (
							<label
								key={type}
								className="flex items-center gap-2 px-2 py-1 hover:bg-slate-50 rounded cursor-pointer"
							>
								<input
									type="checkbox"
									checked={selected.includes(type)}
									onChange={(e) => {
										if (e.target.checked) {
											onChange([...selected, type]);
										} else {
											onChange(selected.filter((t) => t !== type));
										}
									}}
									className="cursor-pointer"
								/>
								<div
									className="w-2 h-2 rounded-full"
									style={{ backgroundColor: NODE_COLORS[type] || NODE_COLORS.default }}
								/>
								<span className="text-sm">{type}</span>
							</label>
						))}
					</div>
				</>
			)}
		</div>
	);
}

// =============================================================================
// Metadata Panel
// =============================================================================

interface MetadataPanelProps {
	node: GraphNode;
	edges: GraphEdge[];
	reviewItems: ReviewItem[];
	onClose: () => void;
	onNavigateToNode: (nodeId: string) => void;
}

function MetadataPanel({
	node,
	edges,
	reviewItems,
	onClose,
	onNavigateToNode,
}: MetadataPanelProps) {
	const [viewMode, setViewMode] = useState<"formatted" | "json">("formatted");
	const [copied, setCopied] = useState(false);

	const incoming = edges.filter((e) => e.target === node.id);
	const outgoing = edges.filter((e) => e.source === node.id);

	// Filter review items for Case node
	const blockers = reviewItems.filter((r) => r.severity === "blocker");
	const warnings = reviewItems.filter((r) => r.severity === "warning");

	const copyToClipboard = () => {
		navigator.clipboard.writeText(JSON.stringify(node, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<div className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] bg-white rounded-lg shadow-xl border border-slate-200 flex flex-col z-10">
			{/* Header */}
			<div className="flex justify-between items-center p-3 border-b border-slate-200">
				<div className="flex items-center gap-2">
					<div
						className="w-3 h-3 rounded-full"
						style={{ backgroundColor: NODE_COLORS[node.label] || NODE_COLORS.default }}
					/>
					<h3 className="font-semibold text-slate-900">{node.label}</h3>
					<span className="text-xs text-slate-500">{getNodeDisplayName(node)}</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={() => setViewMode(viewMode === "formatted" ? "json" : "formatted")}
						className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
					>
						{viewMode === "formatted" ? "JSON" : "View"}
					</button>
					<button
						onClick={copyToClipboard}
						className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
					>
						{copied ? "✓" : "Copy"}
					</button>
					<button
						onClick={onClose}
						className="text-slate-400 hover:text-slate-600 cursor-pointer text-xl leading-none ml-1"
					>
						×
					</button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{/* JSON View Mode */}
				{viewMode === "json" ? (
					<div>
						<pre className="text-xs font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-auto max-h-[calc(100vh-200px)]">
							{JSON.stringify(node, null, 2)}
						</pre>
					</div>
				) : (
					<>
						{/* Node ID - truncated */}
						<div>
							<span className="text-xs font-medium text-slate-500 uppercase">ID</span>
							<p
								className="font-mono text-xs bg-slate-50 p-2 rounded mt-1 text-slate-600"
								title={node.id}
							>
								{node.id.length > 40 ? `${node.id.slice(0, 20)}...${node.id.slice(-15)}` : node.id}
							</p>
						</div>

						{/* Validation Results - Case nodes only */}
						{node.label === "Case" && reviewItems.length > 0 && (
							<div className="border border-slate-200 rounded-lg overflow-hidden">
								<div className="bg-slate-100 px-3 py-2 flex items-center justify-between">
									<span className="text-xs font-medium text-slate-700 uppercase">
										Validation Results
									</span>
									<div className="flex gap-2">
										{blockers.length > 0 && (
											<span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded">
												{blockers.length} blocker{blockers.length > 1 ? "s" : ""}
											</span>
										)}
										{warnings.length > 0 && (
											<span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
												{warnings.length} warning{warnings.length > 1 ? "s" : ""}
											</span>
										)}
									</div>
								</div>
								<div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
									{blockers.map((item, i) => (
										<div key={`b-${i}`} className="px-3 py-2 bg-red-50">
											<div className="flex items-center gap-2">
												<span className="text-red-500">●</span>
												<span className="text-sm font-medium text-red-800">{item.rule}</span>
											</div>
											<p className="text-xs text-red-700 mt-1 ml-4">{item.message}</p>
										</div>
									))}
									{warnings.map((item, i) => (
										<div key={`w-${i}`} className="px-3 py-2 bg-amber-50">
											<div className="flex items-center gap-2">
												<span className="text-amber-500">●</span>
												<span className="text-sm font-medium text-amber-800">{item.rule}</span>
											</div>
											<p className="text-xs text-amber-700 mt-1 ml-4">{item.message}</p>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Document Period Info */}
						{node.label === "Document" &&
							(node.properties.period_start ||
								node.properties.period_end ||
								node.properties.tax_year) && (
								<div className="bg-emerald-50 p-3 rounded-lg">
									<span className="text-xs font-medium text-emerald-700 uppercase">Period</span>
									<div className="mt-2 text-sm space-y-1">
										{node.properties.tax_year != null && (
											<div>
												<span className="text-emerald-600">Tax Year:</span>
												<span className="ml-1 font-mono">{String(node.properties.tax_year)}</span>
											</div>
										)}
										{node.properties.period_start != null && (
											<div>
												<span className="text-emerald-600">Start:</span>
												<span className="ml-1 font-mono">
													{String(node.properties.period_start)}
												</span>
											</div>
										)}
										{node.properties.period_end != null && (
											<div>
												<span className="text-emerald-600">End:</span>
												<span className="ml-1 font-mono">{String(node.properties.period_end)}</span>
											</div>
										)}
									</div>
								</div>
							)}

						{/* Identity Info */}
						{node.label === "Identity" && (
							<div className="bg-pink-50 p-3 rounded-lg">
								<span className="text-xs font-medium text-pink-700 uppercase">Identity Info</span>
								<div className="mt-2 space-y-1 text-sm">
									<div>
										<span className="text-pink-600">Name:</span>
										<span className="ml-1 font-medium">
											{String(node.properties.canonical_name || "—")}
										</span>
									</div>
									<div>
										<span className="text-pink-600">Type:</span>
										<span className="ml-1">{String(node.properties.identity_type || "—")}</span>
									</div>
									{node.properties.borrower_role != null && (
										<div>
											<span className="text-pink-600">Role:</span>
											<span className="ml-1 font-medium text-pink-800">
												{String(node.properties.borrower_role)}
											</span>
										</div>
									)}
									{node.properties.status != null && (
										<div>
											<span className="text-pink-600">Status:</span>
											<span
												className={`ml-1 ${
													node.properties.status === "merged"
														? "text-slate-400"
														: node.properties.status === "ignored"
															? "text-red-500"
															: ""
												}`}
											>
												{String(node.properties.status)}
											</span>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Field/Fact Value */}
						{(node.label === "Field" || node.label === "Fact") && (
							<div className="bg-amber-50 p-3 rounded-lg">
								<span className="text-xs font-medium text-amber-700 uppercase">
									Extracted Value
								</span>
								<div className="mt-2">
									<div className="text-sm text-amber-600">
										{String(node.properties.field_name || "—")}
									</div>
									<div className="font-mono text-lg font-semibold text-amber-900 mt-1 break-all">
										{formatValue(node.properties.value)}
									</div>
									{node.properties.confidence !== undefined && (
										<div className="text-xs text-amber-600 mt-1">
											Confidence: {(Number(node.properties.confidence) * 100).toFixed(0)}%
										</div>
									)}
								</div>
							</div>
						)}

						{/* All Properties (collapsible) */}
						<details className="group">
							<summary className="cursor-pointer text-xs font-medium text-slate-500 uppercase flex items-center gap-1">
								All Properties ({Object.keys(node.properties).length})
								<span className="group-open:rotate-90 inline-block transition-transform">▶</span>
							</summary>
							<div className="mt-2 space-y-2">
								{Object.entries(node.properties).map(([key, value]) => (
									<div key={key} className="bg-slate-50 p-2 rounded">
										<span className="text-xs text-slate-500">{key}</span>
										<p className="font-mono text-sm text-slate-900 break-all">
											{formatValue(value)}
										</p>
									</div>
								))}
							</div>
						</details>

						{/* Incoming edges */}
						{incoming.length > 0 && (
							<div>
								<span className="text-xs font-medium text-slate-500 uppercase">
									Incoming ({incoming.length})
								</span>
								<div className="mt-1 space-y-1">
									{incoming.slice(0, 5).map((edge, i) => (
										<button
											key={i}
											onClick={() => onNavigateToNode(edge.source)}
											className="w-full text-left text-xs p-1.5 bg-blue-50 rounded hover:bg-blue-100 cursor-pointer flex items-center gap-1"
										>
											<span className="text-blue-500">←</span>
											<span className="font-medium text-slate-700">{edge.type}</span>
										</button>
									))}
									{incoming.length > 5 && (
										<div className="text-xs text-slate-400">+{incoming.length - 5} more</div>
									)}
								</div>
							</div>
						)}

						{/* Outgoing edges */}
						{outgoing.length > 0 && (
							<div>
								<span className="text-xs font-medium text-slate-500 uppercase">
									Outgoing ({outgoing.length})
								</span>
								<div className="mt-1 space-y-1">
									{outgoing.slice(0, 5).map((edge, i) => (
										<button
											key={i}
											onClick={() => onNavigateToNode(edge.target)}
											className="w-full text-left text-xs p-1.5 bg-green-50 rounded hover:bg-green-100 cursor-pointer flex items-center gap-1"
										>
											<span className="font-medium text-slate-700">{edge.type}</span>
											<span className="text-green-500">→</span>
										</button>
									))}
									{outgoing.length > 5 && (
										<div className="text-xs text-slate-400">+{outgoing.length - 5} more</div>
									)}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}

// =============================================================================
// Legend
// =============================================================================

interface LegendProps {
	stats: GraphStats;
}

function Legend({ stats }: LegendProps) {
	return (
		<div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-slate-200 p-3 z-10">
			<div className="flex flex-wrap gap-3 max-w-md">
				{Object.entries(stats.nodes_by_type)
					.sort((a, b) => b[1] - a[1])
					.slice(0, 8) // Show top 8 types
					.map(([label, count]) => (
						<div key={label} className="flex items-center gap-1 text-xs">
							<div
								className="w-2.5 h-2.5 rounded-full"
								style={{ backgroundColor: NODE_COLORS[label] || NODE_COLORS.default }}
							/>
							<span className="text-slate-600">{label}</span>
							<span className="text-slate-400">({count})</span>
						</div>
					))}
			</div>
			<div className="text-xs text-slate-500 mt-2 pt-2 border-t border-slate-100">
				{stats.total_nodes} nodes · {stats.total_edges} edges
			</div>
		</div>
	);
}

// =============================================================================
// Helpers
// =============================================================================

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "object") {
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}
	return String(value);
}

function getNodeDisplayName(node: {
	label: string;
	properties: Record<string, unknown>;
	id: string;
}): string {
	const props = node.properties;

	switch (node.label) {
		case "Case":
			return "Case";
		case "File":
			return (
				String(props.filename || node.id)
					.split("/")
					.pop() || "File"
			);
		case "Document":
			return String(props.document_class || props.doc_id || "Doc");
		case "Page":
			return `Page ${props.page_number || "?"}`;
		case "Field":
		case "Fact":
			return String(props.field_name || "Field");
		case "Identity":
			return String(props.canonical_name || props.name || "Identity");
		case "Party":
			return String(props.name || "Party");
		case "Mention":
			return String(props.name_as_found || "Mention");
		case "FinancialEntity":
			return String(props.name || "Entity");
		default:
			return node.label;
	}
}
