import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { resolveApiUrl } from "../../lib/api";

interface BackendVersion {
	component: string;
	version: string;
	git_hash: string;
	git_branch: string;
}

export function VersionBadge() {
	const [expanded, setExpanded] = useState(false);
	const [backendVersion, setBackendVersion] = useState<BackendVersion | null>(null);
	const [versionMismatch, setVersionMismatch] = useState(false);
	const { tenantId } = useAuth();

	// Frontend build-time values
	const feVersion = __APP_VERSION__;
	const feGitHash = __GIT_HASH__;
	const feGitBranch = __GIT_BRANCH__;
	const buildTime = __BUILD_TIME__;

	// Fetch backend version on mount
	useEffect(() => {
		fetch(resolveApiUrl("/api/v1/version"))
			.then((res) => (res.ok ? res.json() : null))
			.then((data: BackendVersion | null) => {
				if (data) {
					setBackendVersion(data);
					// Check if versions match
					setVersionMismatch(data.version !== feVersion || data.git_hash !== feGitHash);
				}
			})
			.catch(() => {
				// Backend not available, that's ok
			});
	}, [feVersion, feGitHash]);

	return (
		<div
			className="fixed bottom-3 right-3 z-50"
			onMouseEnter={() => setExpanded(true)}
			onMouseLeave={() => setExpanded(false)}
		>
			{expanded ? (
				<div className="bg-slate-900/90 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 shadow-lg border border-slate-700 min-w-[200px]">
					<div className="flex flex-col gap-2">
						{/* Tenant Section */}
						{tenantId && (
							<div className="flex items-center justify-between pb-2 border-b border-slate-700">
								<span className="text-slate-400">tenant</span>
								<span className="font-mono font-medium text-cyan-400">{tenantId}</span>
							</div>
						)}

						{/* Frontend Section */}
						<div className="flex flex-col gap-1">
							<div className="text-[10px] text-slate-500 uppercase tracking-wide">Frontend</div>
							<div className="flex items-center justify-between">
								<span className="text-slate-400">version</span>
								<span className="font-mono font-medium text-green-400">v{feVersion}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-slate-400">commit</span>
								<span className="font-mono font-medium text-orange-400">{feGitHash}</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-slate-400">branch</span>
								<span className="font-mono font-medium text-blue-400">{feGitBranch}</span>
							</div>
						</div>

						{/* Backend Section */}
						<div className="flex flex-col gap-1 border-t border-slate-700 pt-2">
							<div className="text-[10px] text-slate-500 uppercase tracking-wide flex items-center gap-2">
								Backend (API)
								{versionMismatch && (
									<span className="text-yellow-500" title="Version mismatch">
										⚠
									</span>
								)}
							</div>
							{backendVersion ? (
								<>
									<div className="flex items-center justify-between">
										<span className="text-slate-400">version</span>
										<span
											className={`font-mono font-medium ${backendVersion.version === feVersion ? "text-green-400" : "text-yellow-400"}`}
										>
											v{backendVersion.version}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-slate-400">commit</span>
										<span
											className={`font-mono font-medium ${backendVersion.git_hash === feGitHash ? "text-orange-400" : "text-yellow-400"}`}
										>
											{backendVersion.git_hash}
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-slate-400">branch</span>
										<span className="font-mono font-medium text-blue-400">
											{backendVersion.git_branch}
										</span>
									</div>
								</>
							) : (
								<div className="text-slate-500 italic">Not connected</div>
							)}
						</div>

						{/* Build time */}
						<div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-700 pt-1">
							<span>built</span>
							<span>{new Date(buildTime).toLocaleString()}</span>
						</div>
					</div>
				</div>
			) : (
				<div
					className={`backdrop-blur-sm text-white text-[10px] font-mono rounded px-2 py-1 shadow-md cursor-default opacity-60 hover:opacity-100 transition-opacity ${versionMismatch ? "bg-yellow-900/80" : "bg-slate-900/80"}`}
				>
					{<span className="text-cyan-400">{tenantId}</span>}
					{tenantId && " · "}v{feVersion} · {feGitHash}
					{versionMismatch && " ⚠"}
				</div>
			)}
		</div>
	);
}
