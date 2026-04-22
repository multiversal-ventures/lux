import { useCallback, useEffect, useMemo, useState } from "react";
import {
	type AggregateResult,
	type EntityResult,
	MultiEntityTable,
	SemanticTable,
	SpecResultCard,
	type TableComponent,
} from "../components/shared";
import { JsonEditor, SpecSelector, YamlEditor } from "../components/workshop";
import {
	type DemoLoanEvaluateResponse,
	type DemoLoanListResponse,
	type DemoLoanSummary,
	type SpecEvaluateResponse,
	evaluateDemoLoan,
	evaluateSpec,
	generateDemoLoanSample,
	generateSampleData,
	getDemoLoans,
	getSpec,
} from "../hooks/useApi";

// Simple YAML-like serializer (for display purposes only)
function toYamlLike(obj: Record<string, unknown>, indent = 0): string {
	const spaces = "  ".repeat(indent);
	let result = "";
	for (const [key, value] of Object.entries(obj)) {
		if (Array.isArray(value)) {
			result += `${spaces}${key}:\n`;
			for (const item of value) {
				if (typeof item === "object" && item !== null) {
					result += `${spaces}  - ${toYamlLike(item as Record<string, unknown>, indent + 2)
						.trim()
						.replace(/\n/g, `\n${spaces}    `)}\n`;
				} else {
					result += `${spaces}  - ${item}\n`;
				}
			}
		} else if (typeof value === "object" && value !== null) {
			result += `${spaces}${key}:\n${toYamlLike(value as Record<string, unknown>, indent + 1)}`;
		} else if (typeof value === "string") {
			result += `${spaces}${key}: "${value}"\n`;
		} else {
			result += `${spaces}${key}: ${value}\n`;
		}
	}
	return result;
}

/**
 * SpecWorkshopPage - Interactive spec editing and evaluation.
 *
 * Two-panel layout:
 * - Left: YAML editor + mock inputs (or demo loan selector)
 * - Right: Table preview + evaluation output
 *
 * Supports:
 * - Single spec mode: Edit YAML, provide inputs, see results
 * - Multi-entity specs (v0.10.0): Entity tabs with worksheets + summary
 * - Demo loan mode (v0.11.0): Run preset spec combinations together
 */
export function SpecWorkshopPage() {
	// Mode: 'spec' for single spec, 'demo' for demo loan
	const [mode, setMode] = useState<"spec" | "demo">("spec");

	// Single spec state
	const [yamlContent, setYamlContent] = useState<string>("");
	const [inputsJson, setInputsJson] = useState<string>("{}");
	const [isEvaluating, setIsEvaluating] = useState(false);
	const [isGenerating, setIsGenerating] = useState(false);
	const [evalResult, setEvalResult] = useState<SpecEvaluateResponse | null>(null);
	const [evalError, setEvalError] = useState<string | null>(null);
	const [entityCount, setEntityCount] = useState<number>(2);
	const [dataPattern, setDataPattern] = useState<"complete" | "partial" | "single_year">(
		"complete",
	);
	const [errorCount, setErrorCount] = useState<number>(0);
	const [leftTab, setLeftTab] = useState<"yaml" | "inputs">("yaml");

	// Demo loan state
	const [demoLoans, setDemoLoans] = useState<DemoLoanSummary[]>([]);
	const [selectedDemoLoan, setSelectedDemoLoan] = useState<string | null>(null);
	const [demoLoanResult, setDemoLoanResult] = useState<DemoLoanEvaluateResponse | null>(null);
	const [demoInputsJson, setDemoInputsJson] = useState<string>("{}");
	const [isLoadingDemoLoans, setIsLoadingDemoLoans] = useState(false);
	const [demoLeftTab, setDemoLeftTab] = useState<"inputs" | "specs" | "manifest">("inputs");
	const [demoSpecsYaml, setDemoSpecsYaml] = useState<Record<string, string>>({});
	const [demoManifestYaml, setDemoManifestYaml] = useState<string>("");
	const [selectedDemoSpecTab, setSelectedDemoSpecTab] = useState<string>("");

	// Load demo loans on mount
	useEffect(() => {
		if (mode === "demo" && demoLoans.length === 0) {
			setIsLoadingDemoLoans(true);
			getDemoLoans()
				.then((response: DemoLoanListResponse) => {
					setDemoLoans(response.demo_loans);
					if (response.demo_loans.length > 0 && !selectedDemoLoan) {
						setSelectedDemoLoan(response.demo_loans[0].id);
					}
				})
				.catch((err: any) => {
					setEvalError(`Failed to load demo loans: ${err.message}`);
				})
				.finally(() => {
					setIsLoadingDemoLoans(false);
				});
		}
	}, [mode, demoLoans.length, selectedDemoLoan]);

	// Load demo spec YAML content when a demo loan is selected
	useEffect(() => {
		if (!selectedDemoLoan || mode !== "demo") return;

		const demoLoan = demoLoans.find((d) => d.id === selectedDemoLoan);
		if (!demoLoan) return;

		// Generate manifest YAML from demo loan config
		const manifestObj = {
			name: demoLoan.name,
			description: demoLoan.description,
			icon: demoLoan.icon,
			specs: demoLoan.specs.map((s: any) => s.id),
			is_multi_entity: demoLoan.is_multi_entity,
		};
		setDemoManifestYaml(toYamlLike(manifestObj));

		// Load YAML content for each spec
		const loadSpecs = async () => {
			const specsContent: Record<string, string> = {};
			for (const spec of demoLoan.specs) {
				try {
					// Try to get spec content from API
					const specContent = await getSpec(spec.name);
					specsContent[spec.id] = specContent.yaml_content;
				} catch {
					specsContent[spec.id] = `# Could not load spec: ${spec.id}`;
				}
			}
			setDemoSpecsYaml(specsContent);
			// Set first spec as selected tab
			if (demoLoan.specs.length > 0) {
				setSelectedDemoSpecTab(demoLoan.specs[0].id);
			}
		};
		loadSpecs();
	}, [selectedDemoLoan, demoLoans, mode]);

	// Detect if the spec has an entity section
	const specHasEntityConfig = useMemo(() => {
		if (!yamlContent) return false;
		// Simple check for entity: in the YAML
		return (
			/^entity:\s*$/m.test(yamlContent) ||
			/\nentity:\s*$/m.test(yamlContent) ||
			yamlContent.includes("\nentity:\n")
		);
	}, [yamlContent]);

	// Check if this is a multi-entity evaluation
	const isMultiEntity = useMemo(() => {
		return evalResult?.entities && evalResult.entities.length > 0;
	}, [evalResult?.entities]);

	// Convert API response components to TableComponent format (for single-entity)
	const tableComponents = useMemo((): TableComponent[] => {
		if (!evalResult?.components) return [];
		return evalResult.components.map((comp: any) => ({
			id: comp.id,
			name: comp.name,
			source_line: comp.source_line,
			sign: comp.sign,
			data_type: comp.data_type,
			y1: comp.y1,
			y2: comp.y2,
			role: comp.role,
			emphasis: comp.emphasis,
			group_id: comp.group_id,
		}));
	}, [evalResult?.components]);

	// Convert entity results to MultiEntityTable format
	const entityResults = useMemo((): EntityResult[] => {
		if (!evalResult?.entities) return [];
		return evalResult.entities.map((entity: any) => ({
			id: entity.id,
			name: entity.name,
			type: entity.type,
			components: entity.components.map((comp: any) => ({
				id: comp.id,
				name: comp.name,
				source_line: comp.source_line,
				sign: comp.sign,
				data_type: comp.data_type,
				y1: comp.y1,
				y2: comp.y2,
				role: comp.role,
				emphasis: comp.emphasis,
				group_id: comp.group_id,
			})),
			derivations: entity.derivations,
		}));
	}, [evalResult?.entities]);

	// Convert aggregate results
	const aggregateResult = useMemo((): AggregateResult | undefined => {
		if (!evalResult?.aggregate) return undefined;
		return {
			values: evalResult.aggregate.values,
			components: evalResult.aggregate.components.map((comp: any) => ({
				id: comp.id,
				name: comp.name,
				source_line: comp.source_line,
				sign: comp.sign,
				data_type: comp.data_type,
				y1: comp.y1,
				y2: comp.y2,
				role: comp.role,
				emphasis: comp.emphasis,
				group_id: comp.group_id,
			})),
		};
	}, [evalResult?.aggregate]);

	// Debounced evaluation
	useEffect(() => {
		if (!yamlContent) {
			setEvalResult(null);
			return;
		}

		const timer = setTimeout(async () => {
			try {
				setIsEvaluating(true);
				setEvalError(null);

				// Parse inputs JSON
				let inputs: Record<string, unknown> = {};
				try {
					inputs = JSON.parse(inputsJson);
				} catch {
					setEvalError("Invalid JSON in inputs");
					return;
				}

				const result = await evaluateSpec({
					yaml_content: yamlContent,
					inputs,
				});

				setEvalResult(result);
				if (!result.success && result.errors.length > 0) {
					setEvalError(result.errors.join("\n"));
				}
			} catch (err) {
				setEvalError(err instanceof Error ? err.message : "Evaluation failed");
			} finally {
				setIsEvaluating(false);
			}
		}, 500); // 500ms debounce

		return () => clearTimeout(timer);
	}, [yamlContent, inputsJson]);

	const handleSpecSelect = useCallback((content: string) => {
		setYamlContent(content);

		// Extract inputs from the spec to populate defaults
		try {
			const inputsMatch = content.match(/inputs:\s*\n([\s\S]*?)(?:\n\w|$)/);
			if (inputsMatch) {
				// Parse YAML inputs section to extract field names
				// This is a simple extraction - just get field names for now
				const lines = inputsMatch[1].split("\n");
				const inputs: Record<string, number> = {};
				for (const line of lines) {
					const match = line.match(/^\s+-\s+(\w+)/);
					if (match) {
						inputs[match[1]] = 0;
					}
				}
				if (Object.keys(inputs).length > 0) {
					setInputsJson(JSON.stringify(inputs, null, 2));
				}
			}
		} catch {
			// Ignore parsing errors
		}
	}, []);

	const handleManualRun = useCallback(async () => {
		if (!yamlContent) return;

		try {
			setIsEvaluating(true);
			setEvalError(null);

			let inputs: Record<string, unknown> = {};
			try {
				inputs = JSON.parse(inputsJson);
			} catch {
				setEvalError("Invalid JSON in inputs");
				return;
			}

			const result = await evaluateSpec({
				yaml_content: yamlContent,
				inputs,
			});

			setEvalResult(result);
			if (!result.success && result.errors.length > 0) {
				setEvalError(result.errors.join("\n"));
			}
		} catch (err) {
			setEvalError(err instanceof Error ? err.message : "Evaluation failed");
		} finally {
			setIsEvaluating(false);
		}
	}, [yamlContent, inputsJson]);

	const handleGenerateSample = useCallback(async () => {
		if (!yamlContent) return;

		try {
			setIsGenerating(true);
			setEvalError(null);

			const result = await generateSampleData({
				yaml_content: yamlContent,
				entity_count: specHasEntityConfig ? entityCount : undefined,
				data_pattern: specHasEntityConfig ? dataPattern : undefined,
				error_count: specHasEntityConfig ? errorCount : undefined,
			});

			if (result.success) {
				setInputsJson(JSON.stringify(result.inputs, null, 2));
			} else if (result.errors.length > 0) {
				setEvalError(result.errors.join("\n"));
			}
		} catch (err) {
			setEvalError(err instanceof Error ? err.message : "Sample generation failed");
		} finally {
			setIsGenerating(false);
		}
	}, [yamlContent, specHasEntityConfig, entityCount, dataPattern, errorCount]);

	// Demo loan handlers
	const handleDemoLoanRun = useCallback(async () => {
		if (!selectedDemoLoan) return;

		try {
			setIsEvaluating(true);
			setEvalError(null);

			let inputs: Record<string, unknown> = {};
			try {
				inputs = JSON.parse(demoInputsJson);
			} catch {
				setEvalError("Invalid JSON in inputs");
				return;
			}

			const result = await evaluateDemoLoan(selectedDemoLoan, inputs);
			setDemoLoanResult(result);
			if (!result.success && result.errors.length > 0) {
				setEvalError(result.errors.join("\n"));
			}
		} catch (err) {
			setEvalError(err instanceof Error ? err.message : "Demo loan evaluation failed");
		} finally {
			setIsEvaluating(false);
		}
	}, [selectedDemoLoan, demoInputsJson]);

	const handleDemoLoanGenerateSample = useCallback(async () => {
		if (!selectedDemoLoan) return;

		try {
			setIsGenerating(true);
			setEvalError(null);

			// Get selected demo info to check if multi-entity
			const demoInfo = demoLoans.find((d) => d.id === selectedDemoLoan);
			const isMulti = demoInfo?.is_multi_entity || false;

			const result = await generateDemoLoanSample(selectedDemoLoan, {
				entity_count: isMulti ? entityCount : 1,
				data_pattern: dataPattern,
			});

			if (result.success) {
				setDemoInputsJson(JSON.stringify(result.inputs, null, 2));
			} else if (result.errors.length > 0) {
				setEvalError(result.errors.join("\n"));
			}
		} catch (err) {
			setEvalError(err instanceof Error ? err.message : "Sample generation failed");
		} finally {
			setIsGenerating(false);
		}
	}, [selectedDemoLoan, entityCount, dataPattern, demoLoans]);

	// Get selected demo loan info
	const selectedDemoLoanInfo = useMemo(() => {
		return demoLoans.find((d) => d.id === selectedDemoLoan);
	}, [demoLoans, selectedDemoLoan]);

	return (
		<div className="h-full flex flex-col bg-slate-100">
			{/* Header */}
			<div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
				<div className="flex items-center gap-6">
					<div>
						<h1 className="text-xl font-semibold text-slate-900">Spec Workshop</h1>
						<p className="text-sm text-slate-500">
							{mode === "spec"
								? "Edit YAML specs and preview table rendering"
								: "Run demo loan spec combinations"}
						</p>
					</div>

					{/* Mode toggle */}
					<div className="flex bg-slate-100 rounded-lg p-1">
						<button
							onClick={() => setMode("spec")}
							className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
								mode === "spec"
									? "bg-white text-slate-900 shadow-sm"
									: "text-slate-500 hover:text-slate-700"
							}`}
						>
							Single Spec
						</button>
						<button
							onClick={() => setMode("demo")}
							className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
								mode === "demo"
									? "bg-white text-slate-900 shadow-sm"
									: "text-slate-500 hover:text-slate-700"
							}`}
						>
							Demo Loan
						</button>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{isEvaluating && <span className="text-sm text-slate-500">Evaluating...</span>}
					<button
						onClick={mode === "spec" ? handleManualRun : handleDemoLoanRun}
						disabled={(mode === "spec" ? !yamlContent : !selectedDemoLoan) || isEvaluating}
						className="px-4 py-2 bg-action text-white text-sm font-medium rounded-lg hover:bg-action-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						Run
					</button>
				</div>
			</div>

			{/* Main content - two panel layout */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left panel */}
				<div className="w-1/2 flex flex-col border-r border-slate-200 bg-white">
					{mode === "spec" ? (
						<>
							{/* Spec selector */}
							<div className="px-4 py-3 border-b border-slate-200">
								<label className="block text-sm font-medium text-slate-700 mb-1">Load Spec</label>
								<SpecSelector onSelect={handleSpecSelect} />
							</div>

							{/* Tab bar */}
							<div className="flex border-b border-slate-200">
								<button
									onClick={() => setLeftTab("yaml")}
									className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
										leftTab === "yaml"
											? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
											: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
									}`}
								>
									YAML Spec
								</button>
								<button
									onClick={() => setLeftTab("inputs")}
									className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
										leftTab === "inputs"
											? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50"
											: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
									}`}
								>
									Mock Inputs
									{specHasEntityConfig && (
										<span className="ml-1.5 text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
											Multi
										</span>
									)}
								</button>
							</div>

							{/* Tab content */}
							<div className="flex-1 overflow-hidden flex flex-col">
								{leftTab === "yaml" ? (
									/* YAML editor */
									<div className="flex-1 p-4 overflow-hidden flex flex-col">
										<div className="flex-1 min-h-0">
											<YamlEditor
												value={yamlContent}
												onChange={setYamlContent}
												placeholder="# Paste or write YAML spec here..."
											/>
										</div>
									</div>
								) : (
									/* Mock inputs */
									<div className="flex-1 flex flex-col overflow-hidden">
										{/* Generation toolbar */}
										<div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
											<div className="flex flex-wrap items-center gap-3">
												{specHasEntityConfig && (
													<>
														<div className="flex items-center gap-2">
															<label className="text-xs font-medium text-slate-600">Entities</label>
															<select
																value={entityCount}
																onChange={(e) => setEntityCount(Number(e.target.value))}
																className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
															>
																{[1, 2, 3, 4, 5].map((n) => (
																	<option key={n} value={n}>
																		{n}
																	</option>
																))}
															</select>
														</div>
														<div className="flex items-center gap-2">
															<label className="text-xs font-medium text-slate-600">Pattern</label>
															<select
																value={dataPattern}
																onChange={(e) =>
																	setDataPattern(
																		e.target.value as "complete" | "partial" | "single_year",
																	)
																}
																className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
																title="Data pattern for year coverage"
															>
																<option value="complete">Complete</option>
																<option value="partial">Partial</option>
																<option value="single_year">Single Year</option>
															</select>
														</div>
														<div className="flex items-center gap-2">
															<label className="text-xs font-medium text-slate-600">Errors</label>
															<select
																value={errorCount}
																onChange={(e) => setErrorCount(Number(e.target.value))}
																className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
																title="Number of error scenarios"
															>
																<option value={0}>None</option>
																<option value={1}>Unknown</option>
																<option value={2}>+Incomplete</option>
																<option value={3}>+Orphans</option>
															</select>
														</div>
													</>
												)}
												<button
													onClick={handleGenerateSample}
													disabled={!yamlContent || isGenerating}
													className="ml-auto px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
												>
													{isGenerating ? (
														<>
															<span className="animate-spin">⟳</span>
															Generating...
														</>
													) : (
														<>
															<span>✨</span>
															Generate Sample
														</>
													)}
												</button>
											</div>
										</div>
										{/* JSON editor - full height */}
										<div className="flex-1 p-4 overflow-hidden">
											<JsonEditor value={inputsJson} onChange={setInputsJson} placeholder="{}" />
										</div>
									</div>
								)}
							</div>
						</>
					) : (
						/* Demo Loan Mode */
						<>
							{/* Demo loan selector */}
							<div className="px-4 py-3 border-b border-slate-200">
								<label className="block text-sm font-medium text-slate-700 mb-1">
									Select Demo Loan
								</label>
								{isLoadingDemoLoans ? (
									<div className="text-sm text-slate-500">Loading demo loans...</div>
								) : (
									<select
										value={selectedDemoLoan || ""}
										onChange={(e) => setSelectedDemoLoan(e.target.value)}
										className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
									>
										{demoLoans.map((dl) => (
											<option key={dl.id} value={dl.id}>
												{dl.icon} {dl.name}
											</option>
										))}
									</select>
								)}
							</div>

							{/* Demo loan info */}
							{selectedDemoLoanInfo && (
								<div className="px-4 py-3 border-b border-slate-200 bg-slate-50/50">
									<p className="text-sm text-slate-600 mb-2">{selectedDemoLoanInfo.description}</p>
									<div className="flex flex-wrap gap-1">
										{selectedDemoLoanInfo.specs.map((spec: any) => (
											<span
												key={spec.id}
												className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded"
											>
												{spec.name}
											</span>
										))}
									</div>
									{selectedDemoLoanInfo.is_multi_entity && (
										<span className="mt-2 inline-block px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
											Multi-Entity
										</span>
									)}
								</div>
							)}

							{/* Tab bar for demo mode */}
							<div className="flex border-b border-slate-200">
								<button
									onClick={() => setDemoLeftTab("inputs")}
									className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
										demoLeftTab === "inputs"
											? "text-purple-600 border-b-2 border-purple-600 bg-purple-50/50"
											: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
									}`}
								>
									Mock Inputs
								</button>
								<button
									onClick={() => setDemoLeftTab("specs")}
									className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
										demoLeftTab === "specs"
											? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
											: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
									}`}
								>
									Specs ({selectedDemoLoanInfo?.specs.length || 0})
								</button>
								<button
									onClick={() => setDemoLeftTab("manifest")}
									className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
										demoLeftTab === "manifest"
											? "text-green-600 border-b-2 border-green-600 bg-green-50/50"
											: "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
									}`}
								>
									Manifest
								</button>
							</div>

							{/* Tab content */}
							<div className="flex-1 flex flex-col overflow-hidden">
								{demoLeftTab === "inputs" && (
									<>
										{/* Generation controls */}
										<div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
											<div className="flex flex-wrap items-center gap-3">
												<div className="flex items-center gap-2">
													<label className="text-xs font-medium text-slate-600">Entities</label>
													<select
														value={entityCount}
														onChange={(e) => setEntityCount(Number(e.target.value))}
														className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
													>
														{[1, 2, 3, 4, 5].map((n) => (
															<option key={n} value={n}>
																{n}
															</option>
														))}
													</select>
												</div>
												<div className="flex items-center gap-2">
													<label className="text-xs font-medium text-slate-600">Pattern</label>
													<select
														value={dataPattern}
														onChange={(e) =>
															setDataPattern(
																e.target.value as "complete" | "partial" | "single_year",
															)
														}
														className="text-sm border border-slate-300 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
													>
														<option value="complete">Complete</option>
														<option value="partial">Partial</option>
														<option value="single_year">Single Year</option>
													</select>
												</div>
												<button
													onClick={handleDemoLoanGenerateSample}
													disabled={!selectedDemoLoan || isGenerating}
													className="ml-auto px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
												>
													{isGenerating ? (
														<>
															<span className="animate-spin">⟳</span>
															Generating...
														</>
													) : (
														<>
															<span>✨</span>
															Generate Sample
														</>
													)}
												</button>
											</div>
										</div>
										{/* JSON editor */}
										<div className="flex-1 p-4 overflow-hidden">
											<JsonEditor
												value={demoInputsJson}
												onChange={setDemoInputsJson}
												placeholder="{}"
											/>
										</div>
									</>
								)}

								{demoLeftTab === "specs" && (
									<>
										{/* Spec tabs */}
										{selectedDemoLoanInfo && selectedDemoLoanInfo.specs.length > 1 && (
											<div className="px-4 pt-2 pb-0 border-b border-slate-100 bg-slate-50/30 flex gap-1 overflow-x-auto">
												{selectedDemoLoanInfo.specs.map((spec: any) => (
													<button
														key={spec.id}
														onClick={() => setSelectedDemoSpecTab(spec.id)}
														className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap ${
															selectedDemoSpecTab === spec.id
																? "bg-white text-blue-600 border border-b-0 border-slate-200"
																: "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
														}`}
													>
														{spec.name || spec.id}
													</button>
												))}
											</div>
										)}
										{/* YAML viewer (read-only) */}
										<div className="flex-1 p-4 overflow-hidden">
											<YamlEditor
												value={demoSpecsYaml[selectedDemoSpecTab] || "# Loading..."}
												onChange={() => {}} // Read-only
												placeholder="# Loading spec..."
											/>
										</div>
									</>
								)}

								{demoLeftTab === "manifest" && (
									<div className="flex-1 p-4 overflow-hidden">
										<YamlEditor
											value={demoManifestYaml}
											onChange={() => {}} // Read-only
											placeholder="# Loading manifest..."
										/>
									</div>
								)}
							</div>
						</>
					)}
				</div>

				{/* Right panel - Preview */}
				<div className="w-1/2 flex flex-col bg-slate-50">
					{/* Table preview */}
					<div className="flex-1 p-4 overflow-auto">
						<div className="flex items-center justify-between mb-3">
							<h2 className="text-sm font-medium text-slate-700">
								{mode === "spec" ? "Table Preview" : "Demo Loan Results"}
							</h2>
							{mode === "spec" && isMultiEntity && (
								<span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
									Multi-Entity Mode
								</span>
							)}
							{mode === "demo" && demoLoanResult && (
								<span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
									{demoLoanResult.spec_results.length} Specs
								</span>
							)}
						</div>

						{mode === "spec" ? (
							/* Single Spec Mode */
							isMultiEntity ? (
								<MultiEntityTable
									entities={entityResults}
									aggregate={aggregateResult}
									columns={evalResult?.columns}
									groups={evalResult?.groups}
								/>
							) : tableComponents.length > 0 ? (
								<SemanticTable
									components={tableComponents}
									columns={evalResult?.columns}
									groups={evalResult?.groups}
								/>
							) : (
								<div className="bg-white rounded-lg border border-slate-200 p-4">
									<p className="text-sm text-slate-500 italic">
										{isEvaluating
											? "Evaluating..."
											: "Load a spec and add inputs to see table preview"}
									</p>
								</div>
							)
						) : /* Demo Loan Mode */
						demoLoanResult ? (
							<div className="space-y-4">
								{/* Total monthly income summary */}
								{demoLoanResult.total_monthly_income != null && (
									<div className="p-4 bg-green-50 border border-green-200 rounded-lg">
										<div className="flex items-center justify-between">
											<div>
												<div className="text-sm text-green-700 font-medium">
													Total Monthly Qualifying Income
												</div>
												<div className="text-2xl font-bold text-green-800">
													$
													{demoLoanResult.total_monthly_income.toLocaleString("en-US", {
														minimumFractionDigits: 2,
														maximumFractionDigits: 2,
													})}
												</div>
											</div>
											<div className="text-right">
												<div className="text-xs text-green-600">
													{demoLoanResult.demo_loan_name}
												</div>
												<div className="text-xs text-green-500">
													{demoLoanResult.spec_results.length} specs evaluated
												</div>
											</div>
										</div>
									</div>
								)}

								{/* Individual spec results - use MultiEntityTable for multi-entity specs */}
								{demoLoanResult.spec_results.map((specResult: any) => {
									// Check if this is a multi-entity spec result
									const isMultiEntitySpec =
										specResult.is_multi_entity &&
										specResult.entities &&
										specResult.entities.length > 0;

									if (isMultiEntitySpec) {
										// Map entity results to MultiEntityTable format
										const entityResultsForTable: EntityResult[] = specResult.entities!.map(
											(entity: any) => ({
												id: entity.id,
												name: entity.name,
												type: entity.type || "",
												components: entity.components.map((comp: any) => ({
													id: comp.id,
													name: comp.name,
													source_line: comp.source_line,
													sign: comp.sign,
													data_type: comp.data_type,
													y1: comp.y1,
													y2: comp.y2,
													role: comp.role,
													emphasis: comp.emphasis,
													group_id: comp.group_id,
												})),
												derivations: entity.derivations,
											}),
										);

										const aggregateForTable: AggregateResult | undefined = specResult.aggregate
											? {
													values: specResult.aggregate.values,
													components: specResult.aggregate.components.map((comp: any) => ({
														id: comp.id,
														name: comp.name,
														source_line: comp.source_line,
														sign: comp.sign,
														data_type: comp.data_type,
														y1: comp.y1,
														y2: comp.y2,
														role: comp.role,
														emphasis: comp.emphasis,
														group_id: comp.group_id,
													})),
												}
											: undefined;

										return (
											<div
												key={specResult.spec_id}
												className="bg-white rounded-lg border border-slate-200 overflow-hidden"
											>
												<div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
													<h3 className="font-medium text-slate-800">{specResult.table_name}</h3>
													<p className="text-xs text-slate-500">{specResult.spec_id}</p>
												</div>
												<div className="p-4">
													<MultiEntityTable
														entities={entityResultsForTable}
														aggregate={aggregateForTable}
														columns={specResult.columns}
														groups={specResult.groups}
													/>
												</div>
											</div>
										);
									}

									// Single-entity spec - use SpecResultCard
									return (
										<SpecResultCard
											key={specResult.spec_id}
											tableName={specResult.table_name}
											specFile={specResult.spec_id}
											components={specResult.components.map((comp: any) => ({
												id: comp.id,
												name: comp.name,
												source_line: comp.source_line,
												sign: comp.sign,
												data_type: comp.data_type,
												y1: comp.y1,
												y2: comp.y2,
												role: comp.role,
												emphasis: comp.emphasis,
												group_id: comp.group_id,
											}))}
											columns={specResult.columns}
											groups={specResult.groups}
											defaultExpanded={true}
											compact={true}
										/>
									);
								})}
							</div>
						) : (
							<div className="bg-white rounded-lg border border-slate-200 p-4">
								<p className="text-sm text-slate-500 italic">
									{isEvaluating
										? "Evaluating..."
										: "Select a demo loan and click Run to see results"}
								</p>
							</div>
						)}
					</div>

					{/* Evaluation output */}
					<div className="h-64 border-t border-slate-200 p-4 overflow-auto">
						<h2 className="text-sm font-medium text-slate-700 mb-3">Evaluation Output</h2>

						{evalError && (
							<div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
								<p className="text-sm text-red-700 font-medium">Errors</p>
								<pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">{evalError}</pre>
							</div>
						)}

						{evalResult && (
							<div className="space-y-3">
								{/* Multi-entity summary */}
								{isMultiEntity && evalResult.entities && (
									<div className="bg-purple-50 rounded-lg border border-purple-200 p-3">
										<p className="text-sm font-medium text-purple-700">
											Multi-Entity Evaluation ({evalResult.entities.length} entities)
										</p>
										<div className="mt-2 space-y-1">
											{evalResult.entities.map((entity: any) => (
												<div key={entity.id} className="flex items-center justify-between text-xs">
													<span className="text-purple-600">{entity.name}</span>
													<span className="text-purple-500 font-mono">{entity.id}</span>
												</div>
											))}
										</div>
										{evalResult.guidance && (
											<p className="text-xs text-purple-500 mt-2">{evalResult.guidance}</p>
										)}
									</div>
								)}

								{/* Outcome (single-entity) */}
								{!isMultiEntity && evalResult.outcome && (
									<div className="bg-white rounded-lg border border-slate-200 p-3">
										<p className="text-sm font-medium text-slate-700">Outcome</p>
										<p className="text-sm text-blue-600 mt-1">{evalResult.outcome}</p>
										{evalResult.guidance && (
											<p className="text-xs text-slate-500 mt-1">{evalResult.guidance}</p>
										)}
									</div>
								)}

								{/* Derivations */}
								{Object.keys(evalResult.derivations).length > 0 && (
									<details className="bg-white rounded-lg border border-slate-200">
										<summary className="px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
											Derivations ({Object.keys(evalResult.derivations).length})
										</summary>
										<div className="px-3 pb-3">
											<pre className="text-xs text-slate-600 overflow-auto">
												{JSON.stringify(evalResult.derivations, null, 2)}
											</pre>
										</div>
									</details>
								)}

								{/* Calculation Steps */}
								{evalResult.calculation_steps.length > 0 && (
									<details className="bg-white rounded-lg border border-slate-200">
										<summary className="px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
											Calculation Steps ({evalResult.calculation_steps.length})
										</summary>
										<div className="px-3 pb-3 space-y-2">
											{evalResult.calculation_steps.map((step) => (
												<div key={step.step_number} className="text-xs">
													<span className="text-slate-400">#{step.step_number}</span>{" "}
													<span className="font-medium">{step.name}</span>
													<div className="text-slate-500 ml-4">
														{step.formula_display || step.formula} ={" "}
														{step.result_formatted || String(step.result)}
													</div>
												</div>
											))}
										</div>
									</details>
								)}

								{/* Proof Trace */}
								{evalResult.proof_trace.length > 0 && (
									<details className="bg-white rounded-lg border border-slate-200">
										<summary className="px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
											Proof Trace ({evalResult.proof_trace.length})
										</summary>
										<div className="px-3 pb-3">
											<ul className="text-xs text-slate-600 space-y-1">
												{evalResult.proof_trace.map((line, idx) => (
													<li key={idx}>{line}</li>
												))}
											</ul>
										</div>
									</details>
								)}

								{/* Warnings */}
								{evalResult.warnings.length > 0 && (
									<div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
										<p className="text-sm font-medium text-amber-700">Warnings</p>
										<ul className="text-xs text-amber-600 mt-1 list-disc list-inside">
											{evalResult.warnings.map((w, idx) => (
												<li key={idx}>{w}</li>
											))}
										</ul>
									</div>
								)}
							</div>
						)}

						{!evalResult && !evalError && (
							<div className="bg-white rounded-lg border border-slate-200 p-4">
								<p className="text-sm text-slate-500 italic">Run evaluation to see output</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
