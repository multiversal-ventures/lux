/**
 * InquiriesTab - List of credit inquiries
 */

import type { Inquiry, InquiryPurpose } from "./types";

interface InquiriesTabProps {
	inquiries: Inquiry[];
}

/** Get inquiry type display info */
function getInquiryTypeInfo(type: InquiryPurpose): { label: string; color: string } {
	const info: Record<InquiryPurpose, { label: string; color: string }> = {
		MORTGAGE: { label: "Mortgage", color: "bg-blue-100 text-blue-700" },
		AUTO_LOAN: { label: "Auto", color: "bg-emerald-100 text-emerald-700" },
		STUDENT_LOAN: { label: "Student", color: "bg-purple-100 text-purple-700" },
		CREDIT_CARD: { label: "Credit Card", color: "bg-amber-100 text-amber-700" },
		HELOC: { label: "HELOC", color: "bg-cyan-100 text-cyan-700" },
		PERSONAL_LOAN: { label: "Personal", color: "bg-pink-100 text-pink-700" },
		LINE_OF_CREDIT: { label: "Line of Credit", color: "bg-orange-100 text-orange-700" },
	};
	return info[type] || { label: type, color: "bg-slate-100 text-slate-700" };
}

export function InquiriesTab({ inquiries }: InquiriesTabProps) {
	// Guard against malformed data
	if (!Array.isArray(inquiries)) {
		return (
			<div className="bg-amber-50 rounded-xl border border-amber-200 p-8 text-center">
				<p className="text-amber-700">Invalid inquiry data</p>
			</div>
		);
	}

	if (inquiries.length === 0) {
		return (
			<div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
				<p className="text-slate-500">No recent inquiries</p>
			</div>
		);
	}

	// Sort by date (most recent first)
	const sortedInquiries = [...inquiries].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);

	return (
		<div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
			{/* Header */}
			<div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
				<div className="flex items-center justify-between">
					<span className="text-sm font-medium text-slate-700">
						{inquiries.length} Inquir{inquiries.length === 1 ? "y" : "ies"} (Last 2 Years)
					</span>
				</div>
			</div>

			{/* List */}
			<div className="divide-y divide-slate-100">
				{sortedInquiries.map((inquiry, idx) => {
					const typeInfo = getInquiryTypeInfo(inquiry.type);

					return (
						<div
							key={idx}
							className="px-4 py-3 flex items-center justify-between hover:bg-slate-50"
						>
							<div className="flex items-center gap-3">
								<div>
									<p className="font-medium text-slate-800">{inquiry.creditor}</p>
									<div className="flex items-center gap-2 mt-0.5">
										<span className={` py-0.5 text-sm text-slate-500 font-medium `}>
											{typeInfo.label}
										</span>
										<span className="text-xs text-slate-400">
											{new Date(inquiry.date).toLocaleDateString()}
										</span>
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<div className="flex items-center gap-1">
									{inquiry.bureau.length === 3 ? (
										<span className="px-2 py-0.5 text-xs text-slate-600 border border-slate-300 rounded-full">
											All
										</span>
									) : (
										inquiry.bureau.map((b) => (
											<span
												key={b}
												className="px-2 py-0.5 text-xs text-slate-600 border border-slate-300 rounded-full"
											>
												{b}
											</span>
										))
									)}
								</div>
								<span className="text-xs text-slate-400 ml-2">{inquiry.date}</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
