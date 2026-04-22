export interface EditNameModalProps {
	open: boolean;
	name: string;
	saving: boolean;
	error: string | null;
	onNameChange: (name: string) => void;
	onClose: () => void;
	onSave: () => void;
}

export function EditNameModal({
	open,
	name,
	saving,
	error,
	onNameChange,
	onClose,
	onSave,
}: EditNameModalProps) {
	if (!open) return null;

	return (
		<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
			<div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
				<div className="px-6 py-4 border-b border-slate-200">
					<h3 className="text-lg font-semibold text-slate-800">Edit Party Name</h3>
				</div>
				<div className="p-6 space-y-4">
					<div>
						<label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
						<input
							type="text"
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
							autoFocus
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
						onClick={onSave}
						disabled={!name.trim() || saving}
						className="px-4 py-2 text-sm font-medium bg-action text-white rounded-lg hover:bg-action-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{saving ? "Saving..." : "Save"}
					</button>
				</div>
			</div>
		</div>
	);
}
