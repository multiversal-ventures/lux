/**
 * SubTabNav - Tab navigation for credit assessment sections
 */

import { CreditCard, BarChart3, FileText, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SubTab = "accounts" | "scores" | "public_records" | "inquiries";

interface TabConfig {
	id: SubTab;
	label: string;
	icon: LucideIcon;
	count?: number;
}

interface SubTabNavProps {
	activeTab: SubTab;
	onTabChange: (tab: SubTab) => void;
	counts: {
		accounts: number;
		publicRecords: number;
		inquiries: number;
	};
}

export function SubTabNav({ activeTab, onTabChange, counts }: SubTabNavProps) {
	const tabs: TabConfig[] = [
		{ id: "accounts", label: "Accounts", icon: CreditCard, count: counts.accounts },
		{ id: "scores", label: "Scores", icon: BarChart3 },
		{ id: "public_records", label: "Public Records", icon: FileText, count: counts.publicRecords },
		{ id: "inquiries", label: "Inquiries", icon: Search, count: counts.inquiries },
	];

	return (
		<div className="flex items-center gap-1 border-b border-slate-200" role="tablist">
			{tabs.map((tab) => {
				const Icon = tab.icon;
				const isActive = activeTab === tab.id;

				return (
					<button
						key={tab.id}
						role="tab"
						aria-selected={isActive}
						aria-controls={`panel-${tab.id}`}
						onClick={() => onTabChange(tab.id)}
						className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
							isActive
								? "font-bold border-slate-700 text-slate-900"
								: "font-medium border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
						}`}
					>
						<Icon className="w-4 h-4" />
						{tab.label}
						{tab.count !== undefined && tab.count > 0 && (
							<span
								className={`px-1.5 py-0.5 text-xs rounded-full ${
									isActive ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"
								}`}
							>
								{tab.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
