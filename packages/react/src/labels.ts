/**
 * Human-facing labels for the Party Hub. The frontend NEVER renders raw backend
 * values (snake_case roles, status enums, event types, codes). Everything an
 * operator/borrower sees is mapped here; unknown values fall back to Title Case.
 */

function titleCase(value: string): string {
	return value
		.replace(/[_-]+/g, " ")
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

const ROLE: Record<string, string> = {
	borrower: "Borrower",
	co_borrower: "Co-borrower",
	guarantor: "Guarantor",
	owner: "Property owner",
	member: "Member",
	trustee: "Trustee",
};

export function roleLabel(role?: string | null): string {
	if (!role) return "Party";
	return ROLE[role] ?? titleCase(role);
}

const PARTY_TYPE: Record<string, string> = {
	individual: "Person",
	entity: "Business",
};

export function partyTypeLabel(type?: string | null): string {
	if (!type) return "";
	return PARTY_TYPE[type] ?? titleCase(type);
}

const IDENTIFIER_TYPE: Record<string, string> = {
	ssn: "SSN",
	itin: "ITIN",
	ein: "EIN",
	passport: "Passport",
	eid: "EID",
};

/** Display label for a masked government identifier type (SSN/EIN/...). */
export function identifierTypeLabel(type?: string | null): string {
	if (!type) return "";
	return IDENTIFIER_TYPE[type] ?? type.toUpperCase();
}

const STATUS: Record<string, string> = {
	open: "Awaiting reply",
	fulfilled: "Received",
	none: "No link yet",
	waiting: "Waiting on borrower",
	submitted: "Submitted",
};

export function statusLabel(status?: string | null): string {
	if (!status) return "";
	return STATUS[status] ?? titleCase(status);
}

const EVENT: Record<string, string> = {
	"portal.operator.requested": "Requested documents",
	"portal.borrower.replied": "Replied",
	"document.borrower.uploaded": "Uploaded documents",
	"document.operator.uploaded": "Uploaded documents",
	"identity.borrower.verified": "Verified identity",
	"identity.portal.corroborated": "Identity corroborated",
	"consent.borrower.signed": "Signed consent",
	"portal.borrower.submitted": "Submitted documents",
};

export function eventLabel(eventType?: string | null): string {
	if (!eventType) return "";
	return EVENT[eventType] ?? titleCase(eventType.split(".").pop() ?? eventType);
}
