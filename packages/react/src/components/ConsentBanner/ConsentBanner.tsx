import type { ConsentState, Intent } from "@fenero/lux-core";

export interface ConsentBannerProps {
	consent: ConsentState;
	onSubmitIntent: (intents: Intent[]) => void;
	className?: string;
}

/**
 * Renders a consent request banner when `doc_sharing` is not yet granted.
 * Returns null when consent is already granted.
 *
 * Pure renderer: the button fires `onSubmitIntent` with the doc_sharing and
 * electronic_records consent intents; the parent decides when/how to call the API.
 */
export function ConsentBanner({
	consent,
	onSubmitIntent,
	className,
}: ConsentBannerProps) {
	if (consent.doc_sharing) return null;

	function handleGrant() {
		onSubmitIntent([
			{ type: "consent", params: { consent_type: "doc_sharing", granted: true } },
			{
				type: "consent",
				params: { consent_type: "electronic_records", granted: true },
			},
		]);
	}

	return (
		<div
			className={`bg-amber-50 border border-amber-200 rounded-xl p-6${className ? ` ${className}` : ""}`}
		>
			<h3 className="font-semibold text-amber-900 mb-2">Before we begin</h3>
			<p className="text-sm text-amber-800 mb-1">
				To move your loan application forward, we need your consent to
				electronically process and share the documents you provide.
			</p>
			<p className="text-sm text-amber-700 mb-4">
				You can revoke this permission at any time by contacting your loan officer.
			</p>
			<button
				type="button"
				onClick={handleGrant}
				className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg text-sm cursor-pointer"
			>
				I agree &mdash; continue
			</button>
		</div>
	);
}
