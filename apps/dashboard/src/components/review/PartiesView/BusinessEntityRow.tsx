import { Combine } from "lucide-react";
import type { PartyWithId } from "./usePartiesViewState";
import type { PartyType } from "./partiesViewTypes";
import { formatPartyName, formatIdentifier } from "./partiesViewUtils";

export interface BusinessEntityRowProps {
	business: PartyWithId;
	docCount: number;
	getPartyType: (party: PartyWithId) => PartyType;
	onTogglePartyType: (partyId: string) => void;
	compact?: boolean;
}

export function BusinessEntityRow({
	business,
	docCount,
	getPartyType,
	onTogglePartyType,
	compact = false,
}: BusinessEntityRowProps) {
	const isIndividual = getPartyType(business) !== "business";

	return (
		<div
			className={
				compact
					? "bg-emerald-50 rounded-lg border border-emerald-200 p-3"
					: "px-4 py-3 hover:bg-slate-50 transition-colors"
			}
		>
			<div className={compact ? "flex items-center gap-2" : "flex items-center justify-between"}>
				<div
					className={
						compact
							? "w-7 h-7 rounded bg-emerald-100 flex items-center justify-center"
							: "w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center"
					}
				>
					<svg
						className={compact ? "w-4 h-4 text-emerald-600" : "w-5 h-5 text-emerald-600"}
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
						/>
					</svg>
				</div>
				<div className="flex-1">
					<div className="flex items-center gap-2">
						<span
							className={
								compact ? "font-medium text-slate-800 text-sm" : "font-medium text-slate-800"
							}
						>
							{formatPartyName(business.name)}
						</span>
						{business.name_aliases && business.name_aliases.length > 0 && (
							<span
								className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded"
								title={`Also known as: ${business.name_aliases.join(", ")}`}
							>
								<Combine className="w-3 h-3" />
								Merged
							</span>
						)}
						<div className="flex items-center gap-2 text-xs" onClick={(e) => e.stopPropagation()}>
							<span
								className={`transition-colors duration-200 ${
									isIndividual ? "text-amber-600 font-medium" : "text-slate-400"
								}`}
							>
								Individual
							</span>
							<button
								type="button"
								role="switch"
								aria-checked={isIndividual}
								onClick={() => onTogglePartyType(business._id)}
								className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200 ease-in-out hover:shadow-md ${
									isIndividual
										? "bg-amber-500 hover:bg-amber-600"
										: "bg-slate-300 hover:bg-slate-400"
								}`}
							>
								<span
									className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transform transition-all duration-200 ease-in-out ${
										isIndividual ? "translate-x-[18px] scale-110" : "translate-x-1"
									}`}
								/>
							</button>
						</div>
					</div>
					<div
						className={
							compact
								? "flex items-center gap-2 text-xs text-slate-500 mt-1"
								: "flex items-center gap-3 mt-1 text-xs text-slate-500"
						}
					>
						{business.identifiers &&
							Object.entries(business.identifiers).map(([key, value], i) => (
								<span key={`${key}-${i}`} className="flex items-center gap-1">
									<span className="uppercase font-medium">{key}:</span>
									<span className="font-mono">{formatIdentifier(key, value)}</span>
								</span>
							))}
						<span className="text-slate-400">
							• {docCount} doc{docCount !== 1 ? "s" : ""}
						</span>
					</div>
					{business.name_aliases && business.name_aliases.length > 0 && (
						<div className="text-xs text-purple-600 mt-0.5">
							Aliases: {business.name_aliases.map(formatPartyName).join(", ")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
