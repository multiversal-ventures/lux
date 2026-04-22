export interface PartiesSummaryCardProps {
	individualsCount: number;
	businessesCount: number;
	documentsCount: number;
}

export function PartiesSummaryCard({
	individualsCount,
	businessesCount,
	documentsCount,
}: PartiesSummaryCardProps) {
	return (
		<div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<div className="text-center">
						<div className="text-2xl font-bold text-slate-800">{individualsCount}</div>
						<div className="text-xs text-slate-500 uppercase">Individuals</div>
					</div>
					<div className="w-px h-10 bg-slate-300" />
					<div className="text-center">
						<div className="text-2xl font-bold text-slate-800">{businessesCount}</div>
						<div className="text-xs text-slate-500 uppercase">Businesses</div>
					</div>
					<div className="w-px h-10 bg-slate-300" />
					<div className="text-center">
						<div className="text-2xl font-bold text-slate-800">{documentsCount}</div>
						<div className="text-xs text-slate-500 uppercase">Documents</div>
					</div>
				</div>
				<div className="text-sm text-slate-500">
					Party identification is based on document extraction
				</div>
			</div>
		</div>
	);
}
