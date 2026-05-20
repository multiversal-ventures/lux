export interface StructuredDocument {
	doc_id: string;
	file_id: string | null;
	regions: Record<string, Record<string, unknown> | Record<string, unknown>[]>;
}

export interface StructuredExtractionsResponse {
	doc_type: string;
	documents: StructuredDocument[];
}

// Credit report region shapes (typed view-model over StructuredDocument.regions)
export interface CreditScore {
	score_model: string;
	score: number;
	reason_codes?: string;
	no_score_reason?: string;
}

export interface TradeAccount {
	company: string;
	account_status?: string;
	account_number?: string;
	account_type?: string;
	portfolio_type?: string;
	balance?: number;
	credit_limit?: number;
	monthly_payment_amount?: number;
	past_due?: number;
	date_opened?: string;
	date_reported?: string;
	date_closed?: string;
	delinquencies_30?: number;
	delinquencies_60?: number;
	delinquencies_90?: number;
}

export interface CreditCollection {
	collection_agency: string;
	original_creditor?: string;
	balance?: number;
	date_opened?: string;
	status?: string;
}

export interface CreditPublicRecord {
	record_type: string;
	court?: string;
	amount?: number;
	date_filed?: string;
	date_resolved?: string;
	status?: string;
}

export interface CreditInquiry {
	company: string;
	date: string;
	industry?: string;
}

export interface CreditReportSummary {
	total_accounts?: number;
	total_balance?: number;
	total_monthly_payments?: number;
	inquiries_count?: number;
	collections_count?: number;
	public_records_count?: number;
}

export interface CreditReportRegions {
	header?: { report_type?: string; date_pulled?: string; bureau?: string };
	personal_info?: { borrower_name?: string; ssn?: string; date_of_birth?: string; current_address?: string };
	credit_scores?: CreditScore[];
	report_summary?: CreditReportSummary;
	trade_accounts?: TradeAccount[];
	collections?: CreditCollection[];
	public_records?: CreditPublicRecord[];
	inquiries?: CreditInquiry[];
	identity_risk?: { ofac_match?: string; mla_match?: string; fraud_alerts?: string };
}

export interface DtiData {
	front_end_dti?: number;
	back_end_dti?: number;
	total_monthly_debt?: number;
}
