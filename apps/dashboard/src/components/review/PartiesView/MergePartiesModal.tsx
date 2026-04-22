import type { PartyWithId } from "./usePartiesViewState";
import { formatPartyName } from "./partiesViewUtils";

export interface MergePartiesModalProps {
	open: boolean;
	sourceId: string | null;
	targetId: string | null;
	newName: string;
	parties: PartyWithId[];
	merging: boolean;
	error: string | null;
	onTargetChange: (id: string | null) => void;
	onNewNameChange: (name: string) => void;
	onClose: () => void;
	onConfirm: () => void;
}

export function MergePartiesModal({
	open,
	sourceId,
	targetId,
	newName,
	parties,
	merging,
	error,
	onTargetChange,
	onNewNameChange,
	onClose,
	onConfirm,
}: MergePartiesModalProps) {
	if (!open) return null;

	const sourceParty = parties.find((p) => p._id === sourceId);
	const otherParties = parties.filter((p) => p._id !== sourceId);

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
				<div className="px-6 py-4 border-b border-slate-200">
					<h3 className="text-lg font-semibold text-slate-800">Merge Parties</h3>
					<p className="text-sm text-slate-500 mt-1">
						Combine two parties into one. The source party will be merged into the target.
					</p>
				</div>
				<div className="p-6 space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-1">
							Source (will be removed)
						</label>
						<div className="px-3 py-2 bg-slate-100 rounded-lg text-sm text-slate-700">
							{formatPartyName(sourceParty?.name ?? "")}
						</div>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-1">
							Target (will keep)
						</label>
						<select
							value={targetId ?? ""}
							onChange={(e) => onTargetChange(e.target.value || null)}
							className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						>
							<option value="">Select party to merge into...</option>
							{otherParties.map((p) => (
								<option key={p._id} value={p._id}>
									{formatPartyName(p.name)}
								</option>
							))}
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-slate-700 mb-1">
							New name (optional)
						</label>
						<input
							type="text"
							value={newName}
							onChange={(e) => onNewNameChange(e.target.value)}
							placeholder="Leave blank to keep target's name"
							className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
						/>
					</div>

					{error && (
						<div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
							{error}
						</div>
					)}
				</div>
				<div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={onConfirm}
						disabled={!targetId || merging}
						className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{merging ? "Merging..." : "Merge Parties"}
					</button>
				</div>
			</div>
		</div>
	);
}
