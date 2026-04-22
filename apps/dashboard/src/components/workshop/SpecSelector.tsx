import { useState, useEffect, useMemo } from "react";
import { getSpecs, getSpec, type SpecSummary } from "../../hooks/useApi";

interface SpecSelectorProps {
	onSelect: (yamlContent: string) => void;
}

/**
 * Formatted folder name for display.
 */
function formatFolderName(folder: string): string {
	// Convert "fnma/income-calculation" -> "FNMA / Income Calculation"
	return folder
		.split("/")
		.map((part) => {
			if (part === "fnma") return "FNMA";
			if (part === "fhlmc") return "FHLMC";
			return part
				.split("-")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" ");
		})
		.join(" / ");
}

export function SpecSelector({ onSelect }: SpecSelectorProps) {
	const [specs, setSpecs] = useState<SpecSummary[]>([]);
	const [folders, setFolders] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadingSpec, setLoadingSpec] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function loadSpecs() {
			try {
				setLoading(true);
				const response = await getSpecs();
				setSpecs(response.specs);
				setFolders(response.folders);
				setError(null);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to load specs");
			} finally {
				setLoading(false);
			}
		}
		loadSpecs();
	}, []);

	// Group specs by folder
	const specsByFolder = useMemo(() => {
		const grouped: Record<string, SpecSummary[]> = {};
		for (const spec of specs) {
			const folder = spec.folder || "other";
			if (!grouped[folder]) {
				grouped[folder] = [];
			}
			grouped[folder].push(spec);
		}
		return grouped;
	}, [specs]);

	const handleSelect = async (specId: string) => {
		if (!specId) return;

		try {
			setLoadingSpec(true);
			const response = await getSpec(specId);
			onSelect(response.yaml_content);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load spec");
		} finally {
			setLoadingSpec(false);
		}
	};

	if (error) {
		return <div className="text-sm text-red-600">{error}</div>;
	}

	return (
		<div className="relative">
			<select
				disabled={loading || loadingSpec}
				onChange={(e) => handleSelect(e.target.value)}
				className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
			>
				<option value="">{loading ? "Loading specs..." : "Select a spec..."}</option>
				{folders.map((folder) => (
					<optgroup key={folder} label={formatFolderName(folder)}>
						{specsByFolder[folder]?.map((spec) => (
							<option key={spec.id} value={spec.id}>
								{spec.table_name || spec.name} (v{spec.version})
							</option>
						))}
					</optgroup>
				))}
			</select>
			{loadingSpec && (
				<div className="absolute right-3 top-1/2 -translate-y-1/2">
					<div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
				</div>
			)}
		</div>
	);
}
