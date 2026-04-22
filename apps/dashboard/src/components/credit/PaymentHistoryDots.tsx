/**
 * PaymentHistoryDots - Visual payment history using Metro 2 codes
 */

import type { PaymentHistoryString, PaymentStatusCode } from "./types";

interface PaymentHistoryDotsProps {
	history: PaymentHistoryString;
	months?: number;
}

/** Get color for payment status code */
function getStatusColor(code: PaymentStatusCode): string {
	switch (code) {
		case "C":
		case "0":
		case "E":
		case "L":
			return "bg-green-500"; // Current
		case "1":
			return "bg-yellow-500"; // 30 days late
		case "2":
			return "bg-orange-500"; // 60 days late
		case "3":
		case "4":
		case "5":
		case "6":
			return "bg-red-500"; // 90+ days late
		case "7":
		case "8":
		case "9":
			return "bg-red-700"; // Bankruptcy/Repo/Collection
		case "D":
		default:
			return "bg-slate-300"; // No data
	}
}

/** Get status label for tooltip */
function getStatusLabel(code: PaymentStatusCode): string {
	switch (code) {
		case "C":
		case "0":
			return "Current";
		case "E":
			return "Zero balance";
		case "L":
			return "Loan modification";
		case "1":
			return "30 days late";
		case "2":
			return "60 days late";
		case "3":
			return "90 days late";
		case "4":
			return "120 days late";
		case "5":
			return "150 days late";
		case "6":
			return "180+ days late";
		case "7":
			return "Bankruptcy";
		case "8":
			return "Repo/Foreclosure";
		case "9":
			return "Collection/Charge-off";
		case "D":
		default:
			return "No data";
	}
}

/** Calculate on-time percentage */
function calculateOnTimePercentage(history: string): number {
	if (!history || history.length === 0) return 100;

	const onTimeCodes = ["C", "0", "E", "L"];
	let onTimeCount = 0;
	let totalCount = 0;

	for (const char of history) {
		if (char !== "D") {
			totalCount++;
			if (onTimeCodes.includes(char)) {
				onTimeCount++;
			}
		}
	}

	if (totalCount === 0) return 100;
	return Math.round((onTimeCount / totalCount) * 100);
}

export function PaymentHistoryDots({ history, months = 24 }: PaymentHistoryDotsProps) {
	// Take the most recent N months (history string is most recent first)
	const displayHistory = history.slice(0, months).padEnd(months, "D");
	const dots = displayHistory.split("") as PaymentStatusCode[];
	const onTimePercentage = calculateOnTimePercentage(displayHistory);

	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-0.5">
				{dots.map((code, idx) => (
					<div
						key={idx}
						className={`w-2.5 h-2.5 rounded-full ${getStatusColor(code)}`}
						title={getStatusLabel(code)}
					/>
				))}
			</div>
			<span
				className={`text-sm font-medium ${
					onTimePercentage === 100
						? "text-green-600"
						: onTimePercentage >= 90
							? "text-amber-600"
							: "text-red-600"
				}`}
			>
				{onTimePercentage}% on-time
			</span>
		</div>
	);
}
