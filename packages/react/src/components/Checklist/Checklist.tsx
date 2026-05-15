import type { ChecklistItem } from "@fenero/lux-core";

export interface ChecklistProps {
	items: ChecklistItem[];
	className?: string;
}

function ChecklistItemCard({ item }: { item: ChecklistItem }) {
	const isVerified = item.status === "verified";

	if (isVerified) {
		return (
			<div className="bg-white border border-green-200 rounded-xl p-4 flex items-center gap-3">
				<span className="text-green-600">&#10003;</span>
				<span className="text-slate-700">{item.title}</span>
			</div>
		);
	}

	return (
		<div className="bg-white border border-slate-200 rounded-xl p-5">
			<div className="flex items-start justify-between">
				<div>
					<h3 className="font-semibold text-slate-900">{item.title}</h3>
					{item.detail && (
						<p className="text-sm text-slate-600 mt-1">{item.detail}</p>
					)}
				</div>
				{item.priority && (
					<span
						className={`text-xs font-medium px-2 py-1 rounded-full ${
							item.priority === "high"
								? "bg-red-100 text-red-700"
								: "bg-amber-100 text-amber-700"
						}`}
					>
						{item.priority}
					</span>
				)}
			</div>
			{item.action && (
				<p className="text-sm text-blue-600 mt-3">{item.action}</p>
			)}
		</div>
	);
}

/**
 * Renders a session checklist — incomplete items first, then verified items.
 * Pure renderer: all state comes from the `items` prop.
 */
export function Checklist({ items, className }: ChecklistProps) {
	const incompleteItems = items.filter((i) => i.status !== "verified");
	const verifiedItems = items.filter((i) => i.status === "verified");

	if (items.length === 0) {
		return (
			<div
				className={`bg-white rounded-xl border border-slate-200 p-8 text-center${className ? ` ${className}` : ""}`}
			>
				<div className="text-3xl mb-3">&#9989;</div>
				<h2 className="text-xl font-semibold text-slate-900 mb-2">
					You&apos;re all caught up
				</h2>
				<p className="text-slate-600 max-w-sm mx-auto">
					Your loan officer hasn&apos;t requested any documents or actions
					yet. When they do, the items will appear here. Check back later
					or wait for a notification.
				</p>
			</div>
		);
	}

	return (
		<div className={`space-y-6${className ? ` ${className}` : ""}`}>
			{incompleteItems.length > 0 && (
				<section>
					<h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
						Action needed ({incompleteItems.length})
					</h2>
					<div className="space-y-3">
						{incompleteItems.map((item) => (
							<ChecklistItemCard key={item.id} item={item} />
						))}
					</div>
				</section>
			)}

			{verifiedItems.length > 0 && (
				<section>
					<h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
						Completed ({verifiedItems.length})
					</h2>
					<div className="space-y-2">
						{verifiedItems.map((item) => (
							<ChecklistItemCard key={item.id} item={item} />
						))}
					</div>
				</section>
			)}
		</div>
	);
}
