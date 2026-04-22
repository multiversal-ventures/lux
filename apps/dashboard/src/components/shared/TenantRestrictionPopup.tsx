/**
 * TenantRestrictionPopup - Modal shown when a tenant restriction is triggered.
 *
 * Currently handles:
 * - PAGE_LIMIT_EXCEEDED: Case exceeds tenant's page limit
 *
 * Future restrictions can be added by checking the `code` field.
 */

import { AlertTriangle, Mail } from "lucide-react";
import { type TenantRestriction, useCaseEventStore } from "../../stores/caseEventStore";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";

// Contact email is frontend-only (not sent from backend)
const CONTACT_EMAIL = "akshay@fenero.ai";

interface TenantRestrictionPopupProps {
	restriction: TenantRestriction;
	onClose: () => void;
}

function PageLimitExceededContent({ restriction, onClose }: TenantRestrictionPopupProps) {
	const handleContact = () => {
		const subject = encodeURIComponent("Page Limit Unlock Request");
		const body = encodeURIComponent(
			`Hi,\n\nMy case exceeds the ${restriction.pageLimit.toLocaleString()} page limit ` +
				`(${restriction.totalPages.toLocaleString()} pages).\n\n` +
				`Please unlock higher limits for my account.\n\nThank you!`,
		);
		window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
	};

	return (
		<>
			<DialogHeader className="pb-2">
				<DialogTitle className="flex items-center gap-2 text-orange-600">
					<AlertTriangle className="h-5 w-5" />
					Page Limit Reached
				</DialogTitle>
			</DialogHeader>

			<div className="py-3">
				<p className="text-sm text-slate-700">
					Your case contains{" "}
					<span className="font-semibold text-orange-600">
						{restriction.totalPages.toLocaleString()}
					</span>{" "}
					pages, which exceeds the{" "}
					<span className="font-semibold">{restriction.pageLimit.toLocaleString()}</span> page limit
					for your account.
				</p>
				<p className="text-sm text-slate-500 mt-3">
					Contact us to unlock higher page limits for your account. Enterprise customers can process
					unlimited pages.
				</p>
			</div>

			<DialogFooter className="flex gap-3 pt-2">
				<button
					onClick={onClose}
					className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
				>
					Dismiss
				</button>
				<button
					onClick={handleContact}
					className="inline-flex items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
				>
					<Mail className="h-4 w-4" />
					Contact {CONTACT_EMAIL}
				</button>
			</DialogFooter>
		</>
	);
}

export function TenantRestrictionPopup() {
	const restriction = useCaseEventStore((s) => s.tenantRestriction);
	const setTenantRestriction = useCaseEventStore((s) => s.setTenantRestriction);

	if (!restriction) return null;

	const handleClose = () => {
		setTenantRestriction(null);
	};

	// Render content based on restriction code
	const renderContent = () => {
		switch (restriction.code) {
			case "PAGE_LIMIT_EXCEEDED":
				return <PageLimitExceededContent restriction={restriction} onClose={handleClose} />;
			default:
				// Generic fallback for unknown restriction codes
				return (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2 text-orange-600">
								<AlertTriangle className="h-5 w-5" />
								Account Restriction
							</DialogTitle>
							<DialogDescription className="text-slate-600">
								{restriction.message}
							</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<button
								onClick={handleClose}
								className="inline-flex items-center justify-center rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-orange-600"
							>
								Dismiss
							</button>
						</DialogFooter>
					</>
				);
		}
	};

	return (
		<Dialog open={true} onOpenChange={(open) => !open && handleClose()}>
			<DialogContent className="sm:max-w-md bg-white border border-slate-200 shadow-lg">
				{renderContent()}
			</DialogContent>
		</Dialog>
	);
}
