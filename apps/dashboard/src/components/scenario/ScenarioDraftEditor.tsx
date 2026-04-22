import { AlertCircle, Calendar, FileText, Loader2, Pencil, Save, Users } from "lucide-react";
import { type ComponentProps, type ReactNode, useMemo, useState } from "react";
import { BorrowersTab } from "./BorrowersTab";
import { DocumentsTab } from "./DocumentsTab";
import { ExtractionTab } from "./ExtractionTab";
import { PeriodsTab } from "./PeriodsTab";

type ScenarioDraftEditorTabId = "periods" | "documents" | "borrowers" | "extraction";

interface ScenarioDraftEditorProps {
	periodsTabProps: ComponentProps<typeof PeriodsTab>;
	documentsTabProps: ComponentProps<typeof DocumentsTab>;
	borrowersTabProps: ComponentProps<typeof BorrowersTab>;
	noteLabel?: string;
	noteValue: string;
	notePlaceholder?: string;
	onNoteChange: (value: string) => void;
	noteDisabled?: boolean;
	allowExtraction?: boolean;
	extractionTabProps?: ComponentProps<typeof ExtractionTab>;
	extractionTabKey?: string;
	extractionEditCount?: number;
	footerStatus: ReactNode;
	footerWarning?: ReactNode;
	onSave: () => void | Promise<void>;
	saveLabel: string;
	savingLabel: string;
	isSaving?: boolean;
	saveDisabled?: boolean;
}

export function ScenarioDraftEditor({
	periodsTabProps,
	documentsTabProps,
	borrowersTabProps,
	noteLabel = "Note",
	noteValue,
	notePlaceholder,
	onNoteChange,
	noteDisabled = false,
	allowExtraction = false,
	extractionTabProps,
	extractionTabKey,
	extractionEditCount = 0,
	footerStatus,
	footerWarning,
	onSave,
	saveLabel,
	savingLabel,
	isSaving = false,
	saveDisabled = false,
}: ScenarioDraftEditorProps) {
	const [activeTab, setActiveTab] = useState<ScenarioDraftEditorTabId>("periods");

	const tabs = useMemo(() => {
		const baseTabs: Array<{
			id: ScenarioDraftEditorTabId;
			label: string;
			icon: typeof Calendar;
			badge?: number;
		}> = [
			{ id: "periods", label: "Periods", icon: Calendar },
			{ id: "documents", label: "Documents", icon: FileText },
			{ id: "borrowers", label: "Borrowers", icon: Users },
		];

		if (allowExtraction && extractionTabProps) {
			baseTabs.push({
				id: "extraction",
				label: "Extraction",
				icon: Pencil,
				badge: extractionEditCount > 0 ? extractionEditCount : undefined,
			});
		}

		return baseTabs;
	}, [allowExtraction, extractionEditCount, extractionTabProps]);

	const currentTab = tabs.some((tab) => tab.id === activeTab)
		? activeTab
		: (tabs[0]?.id ?? "periods");

	return (
		<>
			<div className="flex items-center gap-0 px-6 bg-slate-50 border-b border-slate-200">
				{tabs.map((tab) => {
					const Icon = tab.icon;
					return (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
								currentTab === tab.id
									? "text-slate-800 border-slate-800"
									: "text-slate-500 border-transparent hover:text-slate-700"
							}`}
						>
							<Icon className="w-4 h-4" />
							{tab.label}
							{tab.badge ? (
								<span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
									{tab.badge}
								</span>
							) : null}
						</button>
					);
				})}
			</div>

			<div className="p-6 min-h-[400px]">
				{currentTab === "periods" && <PeriodsTab {...periodsTabProps} />}
				{currentTab === "documents" && <DocumentsTab {...documentsTabProps} />}
				{currentTab === "borrowers" && <BorrowersTab {...borrowersTabProps} />}
				{allowExtraction && currentTab === "extraction" && extractionTabProps && (
					<ExtractionTab key={extractionTabKey} {...extractionTabProps} />
				)}

				<div className="mt-6 border-t border-slate-200 pt-6">
					<h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
						{noteLabel}
					</h2>
					<textarea
						value={noteValue}
						onChange={(event) => onNoteChange(event.target.value)}
						placeholder={notePlaceholder}
						disabled={noteDisabled}
						rows={3}
						className="w-full px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50 resize-none"
					/>
				</div>
			</div>

			<div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
				{footerWarning && (
					<div className="flex items-center gap-2 text-sm text-red-600 mb-3">
						<AlertCircle className="w-4 h-4 shrink-0" />
						{footerWarning}
					</div>
				)}

				<div className="flex items-center justify-between gap-4">
					<p className="text-sm text-slate-500">{footerStatus}</p>
					<button
						onClick={onSave}
						disabled={saveDisabled || isSaving}
						className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
							!saveDisabled && !isSaving
								? "bg-amber-600 text-white hover:bg-amber-700"
								: "bg-slate-200 text-slate-400 cursor-not-allowed"
						}`}
					>
						{isSaving ? (
							<>
								<Loader2 className="w-4 h-4 animate-spin" />
								{savingLabel}
							</>
						) : (
							<>
								<Save className="w-4 h-4" />
								{saveLabel}
							</>
						)}
					</button>
				</div>
			</div>
		</>
	);
}

export default ScenarioDraftEditor;
