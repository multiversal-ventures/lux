import { Lock, ShieldCheck } from "lucide-react";

export function CompliancePage() {
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center select-none bg-[#f1f2f4]">
			<div className="relative mb-8">
				<div className="absolute inset-0 rounded-full bg-[hsl(14_85%_53%_/_0.10)] motion-safe:[animation:ping_1s_cubic-bezier(0,0,0.2,1)_infinite]" />
				<div className="absolute inset-0 rounded-full bg-[hsl(14_85%_53%_/_0.15)] motion-safe:[animation:ping_1s_cubic-bezier(0,0,0.2,1)_infinite] motion-safe:[animation-delay:300ms]" />
				<div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-[hsl(14_85%_53%_/_0.10)] border border-[hsl(14_85%_53%_/_0.20)]">
					<ShieldCheck className="h-9 w-9 text-[hsl(14_85%_53%)]" />
				</div>
			</div>

			<div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[hsl(14_85%_53%_/_0.30)] bg-[hsl(14_85%_53%_/_0.05)] px-3 py-1">
				<span className="relative flex h-2 w-2">
					<span className="absolute inline-flex h-full w-full rounded-full bg-[hsl(14_85%_53%)] opacity-75 motion-safe:[animation:ping_1s_cubic-bezier(0,0,0.2,1)_infinite]" />
					<span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(14_85%_53%)]" />
				</span>
				<span className="text-xs font-medium text-[hsl(14_85%_53%)]">Coming Soon</span>
			</div>

			<h1 className="text-2xl font-semibold tracking-tight text-foreground mb-3">
				One-Click Compliance
			</h1>

			<p className="max-w-md text-sm text-[hsl(215_16%_47%)] leading-relaxed">
				Fenero generates a compliance proof certificate with every income analysis — showing the
				data used, the guideline applied, and the output.
			</p>

			<p className="max-w-md mt-4 text-sm text-[hsl(215_16%_47%)] leading-relaxed">
				When an auditor asks how you got there, you answer in one click instead of rebuilding the
				calculation from scratch.
			</p>

			<div className="mt-8 flex flex-wrap justify-center gap-2">
				{[
					"Audit-ready certificates",
					"Guideline traceability",
					"One-click export",
					"Examiner-ready PDF",
				].map((item) => (
					<span
						key={item}
						className="rounded-full border border-[hsl(214_20%_88%)] bg-[hsl(210_17%_93%_/_0.50)] px-3 py-1 text-xs text-[hsl(215_16%_47%)]"
					>
						{item}
					</span>
				))}
			</div>

			<div className="mt-10 flex items-center gap-1.5 text-xs text-[hsl(215_16%_47%_/_0.60)]">
				<Lock className="h-3 w-3" />
				<span>This feature is not yet available</span>
			</div>
		</div>
	);
}
