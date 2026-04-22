/**
 * Credit Report Types
 * Re-exported from docs/credit/creditIntegration.ts for UI components
 */

export type Bureau = "Equifax" | "Experian" | "TransUnion";

/** ISO 8601 date string (YYYY-MM-DD format) */
export type DateString = string;

/** Payment history string (sequence of PaymentStatusCode characters, most recent first) */
export type PaymentHistoryString = string;

export type FicoScoreModel =
	| "FICO Score 2" // Experian
	| "FICO Score 4" // TransUnion
	| "FICO Score 5" // Equifax
	| "FICO Score 8"
	| "VantageScore 4"
	| "OTHER";

export interface ScoreFactor {
	code: string;
	description: string;
	impact: "POSITIVE" | "NEGATIVE";
}

export interface Address {
	street: string;
	city: string;
	state: string;
	zip: string;
}

export type ResidenceType = "OWN" | "RENT" | "FAMILY" | "OTHER";

export interface CurrentAddress extends Address {
	residenceType: ResidenceType;
	monthsAtAddress: number;
}

export interface AddressHistoryEntry {
	street: string;
	city: string;
	state: string;
	startDate: DateString;
	endDate?: DateString;
}

export interface BorrowerInfo {
	borrowerId: string;
	role: "primary" | "co_borrower";
	ssn: string;
	firstName: string;
	middleName?: string;
	lastName: string;
	dateOfBirth: DateString;
	currentAddress: CurrentAddress;
	addressHistory: AddressHistoryEntry[];
	employer: string;
	position: string;
}

export interface CreditScore {
	bureau: Bureau;
	score: number;
	scoreModel: FicoScoreModel;
	scoreDate: DateString;
	factors: ScoreFactor[];
}

export type AccountType =
	| "MORTGAGE"
	| "AUTO_LOAN"
	| "STUDENT_LOAN"
	| "CREDIT_CARD"
	| "HELOC"
	| "COLLECTION"
	| "PERSONAL_LOAN"
	| "LINE_OF_CREDIT";

export type AccountStatus = "OPEN" | "CLOSED" | "PAID" | "COLLECTION";

export type ResponsibilityType = "INDIVIDUAL" | "JOINT" | "AUTHORIZED_USER" | "COSIGNER";

// Metro 2 Payment Rating Codes
export type PaymentStatusCode =
	| "C"
	| "0"
	| "1"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "D"
	| "E"
	| "L";

export interface InterestRateInfo {
	rate: number;
	type: "FIXED" | "VARIABLE";
}

export interface LoanAccount {
	accountId: string;
	accountType: AccountType;
	creditorName: string;
	accountNumber: string;
	originalAmount: number;
	currentBalance: number;
	highBalance?: number;
	creditLimit?: number;
	monthlyPayment: number;
	interestInfo?: InterestRateInfo;
	termMonths?: number;
	status: AccountStatus;
	responsibilityType?: ResponsibilityType;
	openDate: DateString;
	closedDate?: DateString;
	paymentHistory: PaymentHistoryString;
	includeInDti: boolean;
	dtiPayment: number;
	dtiNote?: string;
	collateral?: string;
	reportedBy: Bureau[];
}

export type PublicRecordType =
	| "BANKRUPTCY"
	| "FORECLOSURE"
	| "JUDGMENT"
	| "COLLECTION"
	| "TAX_LIEN";

export type PublicRecordStatus = "OPEN" | "CLOSED" | "DISCHARGED" | "DISMISSED" | "SATISFIED";

export interface PublicRecord {
	type: PublicRecordType;
	status: PublicRecordStatus;
	amount?: number;
	date: DateString;
	detail?: string;
}

export type InquiryPurpose = Exclude<AccountType, "COLLECTION">;

export type ScoreTier = "EXCEPTIONAL" | "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export interface Inquiry {
	creditor: string;
	date: DateString;
	type: InquiryPurpose;
	bureau: Bureau[];
}

export interface CreditReportData extends BorrowerInfo {
	creditScores: CreditScore[];
	accounts: LoanAccount[];
	publicRecords: PublicRecord[];
	inquiries: Inquiry[];
	riskTier: "LOW" | "MODERATE" | "HIGH";
	positiveFactors: string[];
	negativeFactors: string[];
	reportDate: DateString;
	reportId: string;
}

/** Helper to get score tier from numeric score */
export function getScoreTier(score: number): ScoreTier {
	if (score >= 800) return "EXCEPTIONAL";
	if (score >= 740) return "EXCELLENT";
	if (score >= 670) return "GOOD";
	if (score >= 580) return "FAIR";
	return "POOR";
}

/** Helper to get tier display label */
export function getTierLabel(tier: ScoreTier): string {
	return tier.charAt(0) + tier.slice(1).toLowerCase();
}

/** Helper to calculate age from DOB */
export function calculateAge(dateOfBirth: DateString): number {
	const dob = new Date(dateOfBirth);
	const today = new Date();
	let age = today.getFullYear() - dob.getFullYear();
	const monthDiff = today.getMonth() - dob.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
		age--;
	}
	return age;
}

/** Helper to mask SSN for display */
export function maskSSN(ssn: string): string {
	// If already masked, return as is
	if (ssn.includes("X") || ssn.includes("*")) return ssn;
	const digits = ssn.replace(/\D/g, "");
	if (digits.length === 9) {
		return `XXX-XX-${digits.slice(-4)}`;
	}
	return ssn;
}
