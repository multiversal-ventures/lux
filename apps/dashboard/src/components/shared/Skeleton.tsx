/**
 * Skeleton loading components for visual loading states.
 *
 * Design pattern: Show users what's coming next before data arrives.
 * This creates a visual flow that guides users through the loading process.
 */

interface SkeletonProps {
	className?: string;
}

/**
 * Base skeleton element with pulse animation.
 */
export function Skeleton({ className = "" }: SkeletonProps) {
	return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

interface FileCardSkeletonProps {
	/** Optional filename to display (shows what agent is reading) */
	filename?: string;
}

/**
 * Skeleton for a file card in the overview.
 * Shows placeholder for filename, page count, and status.
 * When filename is provided, shows it with "Opening..." indicator.
 */
export function FileCardSkeleton({ filename }: FileCardSkeletonProps = {}) {
	return (
		<div className="p-3 bg-white rounded-lg border border-slate-200">
			<div className="flex items-start gap-3">
				{/* File icon with pulse animation */}
				<div className="w-10 h-10 rounded-lg bg-orange-100 shrink-0 flex items-center justify-center">
					<svg
						className="w-5 h-5 text-orange-500 animate-pulse"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>

				<div className="flex-1 min-w-0">
					{/* FILE badge + filename (or placeholder) */}
					<div className="flex items-center gap-2">
						<span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-500 text-white">
							FILE
						</span>
						{filename ? (
							<span className="text-sm font-medium text-slate-700 truncate">{filename}</span>
						) : (
							<Skeleton className="h-4 w-32" />
						)}
					</div>

					{/* Opening status with animated dots */}
					<div className="flex items-center gap-2 mt-1.5">
						<span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
							<span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
							Opening...
						</span>
					</div>
				</div>
			</div>

			{/* Document skeleton placeholder - shows what's coming */}
			<div className="mt-3 ml-6">
				<DocumentCardSkeleton />
			</div>
		</div>
	);
}

/**
 * Skeleton for a document card nested under a file.
 * Shows placeholder for document type badge, name, and facts count.
 */
export function DocumentCardSkeleton() {
	return (
		<div className="ml-4 pl-3 py-2 border-l-2 border-slate-200">
			<div className="flex items-center gap-2">
				{/* Document badge placeholder */}
				<Skeleton className="h-4 w-16 rounded" />
				{/* Document name */}
				<Skeleton className="h-4 w-24" />
				{/* Facts badge */}
				<Skeleton className="h-5 w-14 rounded" />
			</div>
			<div className="flex items-center gap-2 mt-1 ml-10">
				{/* Page range */}
				<Skeleton className="h-3 w-20" />
				{/* Period */}
				<Skeleton className="h-3 w-16" />
			</div>
		</div>
	);
}

/**
 * Multiple document skeletons to show expected documents.
 */
export function DocumentSkeletonList({ count = 2 }: { count?: number }) {
	return (
		<div className="space-y-1">
			{Array.from({ length: count }).map((_, i) => (
				<DocumentCardSkeleton key={i} />
			))}
		</div>
	);
}
