/**
 * BorrowerInfoCard - Displays borrower details and risk assessment
 */

import type { CreditReportData } from "./types";
import { calculateAge, maskSSN } from "./types";

interface BorrowerInfoCardProps {
	borrower: CreditReportData;
}

/** Risk tier text/icon/border colors */
function getRiskTierStyle(tier: "LOW" | "MODERATE" | "HIGH"): {
	text: string;
	icon: string;
	border: string;
	borderBox: string;
} {
	switch (tier) {
		case "LOW":
			return {
				text: "text-green-700",
				icon: "text-green-500",
				border: "border-green-500",
				borderBox: "border border-green-500",
			};
		case "MODERATE":
			return {
				text: "text-amber-700",
				icon: "text-amber-500",
				border: "border-amber-500",
				borderBox: "border border-amber-100",
			};
		case "HIGH":
			return {
				text: "text-red-700",
				icon: "text-red-500",
				border: "border-red-500",
				borderBox: "border border-red-500",
			};
	}
}

/** Check icon for LOW risk */
function CheckIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
			/>
		</svg>
	);
}

/** Warning icon for MODERATE/HIGH risk */
function WarningIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
			/>
		</svg>
	);
}

export function BorrowerInfoCard({ borrower }: BorrowerInfoCardProps) {
	const riskStyle = getRiskTierStyle(borrower.riskTier);
	const age = calculateAge(borrower.dateOfBirth);
	const fullName = [borrower.firstName, borrower.middleName, borrower.lastName]
		.filter(Boolean)
		.join(" ");
	const maskedSsn = maskSSN(borrower.ssn);
	const formattedDob = new Date(borrower.dateOfBirth).toLocaleDateString("en-US", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	return (
		<div className="bg-white rounded-xl border border-slate-200 p-6 flex-1">
			{/* Header */}
			<div className="flex items-start justify-between mb-4">
				<div>
					<h2 className="text-xl font-semibold text-slate-800">{fullName}</h2>
					<p className="text-sm text-slate-500 mt-0.5">
						SSN: {maskedSsn} • DOB: {formattedDob} (Age {age})
					</p>
				</div>
				{borrower.role === "primary" && (
					<span className="px-3 py-1 text-xs font-medium bg-slate-800 text-white rounded-full">
						Primary Borrower
					</span>
				)}
				{borrower.role === "co_borrower" && (
					<span className="px-3 py-1 text-xs font-medium bg-slate-200 text-slate-700 rounded-full">
						Co-Borrower
					</span>
				)}
			</div>

			{/* Address and Employer */}
			<div className="grid grid-cols-2 gap-4 mb-4 text-sm">
				<div>
					<span className="text-slate-400 text-xs uppercase tracking-wide">Address</span>
					<p className="text-slate-700 mt-0.5">{borrower.currentAddress.street}</p>
					<p className="text-slate-700">
						{borrower.currentAddress.city}, {borrower.currentAddress.state}{" "}
						{borrower.currentAddress.zip}
					</p>
				</div>
				<div>
					<span className="text-slate-400 text-xs uppercase tracking-wide">Employer</span>
					<p className="text-slate-700 mt-0.5">{borrower.employer}</p>
					<p className="text-slate-700">{borrower.position}</p>
				</div>
			</div>

			{/* Risk Assessment */}
			<div className={`rounded-lg p-4 ${riskStyle.borderBox}`}>
				<div className="flex items-center gap-2 mb-3">
					{borrower.riskTier === "LOW" ? (
						<CheckIcon className={`w-5 h-5 ${riskStyle.icon}`} />
					) : (
						<WarningIcon className={`w-5 h-5 ${riskStyle.icon}`} />
					)}
					<span className={`font-semibold ${riskStyle.text}`}>{borrower.riskTier} Risk</span>
				</div>

				<div className="grid grid-cols-2 gap-4">
					{/* Positive Factors */}
					<div className="rounded-md px-3 py-2">
						<span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
							Positive Factors
						</span>
						<ul className="mt-1.5 space-y-1">
							{borrower.positiveFactors.map((factor, idx) => (
								<li key={idx} className="flex items-start gap-1.5 text-xs text-slate-700">
									<span className="text-green-500 mt-0.5">↗</span>
									{factor}
								</li>
							))}
							{borrower.positiveFactors.length === 0 && (
								<li className="text-xs text-slate-400 italic">None identified</li>
							)}
						</ul>
					</div>

					{/* Negative Factors */}
					<div className="rounded-md px-3 py-2">
						<span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
							Negative Factors
						</span>
						<ul className="mt-1.5 space-y-1">
							{borrower.negativeFactors.map((factor, idx) => (
								<li key={idx} className="flex items-start gap-1.5 text-xs text-slate-700">
									<span className="text-red-500 mt-0.5">↘</span>
									{factor}
								</li>
							))}
							{borrower.negativeFactors.length === 0 && (
								<li className="text-xs text-slate-400 italic">None identified</li>
							)}
						</ul>
					</div>
				</div>
			</div>
		</div>
	);
}
