/**
 * CreditTab - Main container for credit assessment UI
 */

import { AlertCircle, CreditCard, FileText, Loader2, RefreshCw, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	type GetCreditVerificationResponse,
	cancelWorkflows,
	startCreditVerificationWithOptions,
} from "../../hooks/useApi";
import {
	useAdaptiveRefetchInterval,
	useCaseQueryInvalidation,
	useCaseStatus,
	useCreditPullStatus,
	useCreditVerification,
	useWorkflowStatus,
} from "../../hooks/useCaseQueries";
import { api } from "../../lib/api";
import { PullCreditModal } from "../results/PullCreditModal";
import { UploadModal } from "../shared";
import { AccountsList } from "./AccountsList";
import { BorrowerInfoCard } from "./BorrowerInfoCard";
import { BorrowerSelector } from "./BorrowerSelector";
import { CreditScorePanel } from "./CreditScorePanel";
import { CreditSummaryStats } from "./CreditSummaryStats";
import { InquiriesTab } from "./InquiriesTab";
import { PublicRecordsTab } from "./PublicRecordsTab";
import { ScoresTab } from "./ScoresTab";
import { type SubTab, SubTabNav } from "./SubTabNav";
import type { CreditReportData } from "./types";

/**
 * Upload state machine for tracking extraction progress.
 * - idle: No upload in progress
 * - extracting: Extraction workflow running
 * - error: Workflow failed
 */
type UploadPhase = "idle" | "extracting" | "error";

interface UploadState {
	phase: UploadPhase;
	fileNames: string[];
	errorMessage?: string;
}

interface CreditTabProps {
	caseId: string;
	onStartVerification?: () => void;
}

type CreditScoreData = CreditReportData["creditScores"][number];
type LoanAccountData = CreditReportData["accounts"][number];
type PublicRecordData = CreditReportData["publicRecords"][number];
type InquiryData = CreditReportData["inquiries"][number];

const TODAY_ISO = new Date().toISOString().slice(0, 10);

/** Skeleton pulse animation component */
function Skeleton({ className = "" }: { className?: string }) {
	return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

/** Loading skeleton for credit tab */
function CreditTabSkeleton() {
	return (
		<div className="h-full overflow-auto p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<Skeleton className="h-8 w-56 mb-2" />
						<Skeleton className="h-4 w-40" />
					</div>
					<Skeleton className="h-10 w-48 rounded-lg" />
				</div>

				<div className="flex gap-6">
					<div className="w-64 shrink-0">
						<div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
							<Skeleton className="h-5 w-24" />
							<div className="flex justify-center">
								<Skeleton className="h-32 w-32 rounded-full" />
							</div>
							<div className="space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-full" />
							</div>
						</div>
					</div>
					<div className="flex-1 bg-white rounded-xl border border-slate-200 p-6 space-y-4">
						<Skeleton className="h-5 w-32" />
						<div className="grid grid-cols-2 gap-4">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					</div>
				</div>

				<div className="grid grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
							<Skeleton className="h-4 w-24 mb-2" />
							<Skeleton className="h-8 w-16" />
						</div>
					))}
				</div>

				<div className="flex gap-4 border-b border-slate-200 pb-3">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-8 w-24" />
					))}
				</div>

				<div className="space-y-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="bg-white rounded-lg border border-slate-200 p-4">
							<div className="flex items-center justify-between mb-4">
								<Skeleton className="h-5 w-48" />
								<Skeleton className="h-6 w-20 rounded-full" />
							</div>
							<div className="space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

/** Error state component */
function ErrorState({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="h-full flex items-center justify-center text-slate-500">
			<div className="text-center max-w-md">
				<AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
				<p className="text-lg font-medium text-slate-700">Failed to Load Credit Data</p>
				<p className="text-sm mt-2 text-slate-500">{message}</p>
				<button
					onClick={onRetry}
					className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
				>
					<RefreshCw className="w-4 h-4" />
					Try Again
				</button>
			</div>
		</div>
	);
}

/** Empty state component */
function EmptyState({
	hasResults,
	onRun,
	runButtonLabel,
	runDisabled,
	onUpload,
	onPullCredit,
	isExtracting,
	extractionStatus,
	extractionProgress,
	fileNames,
	onCancelExtraction,
	isCanceling,
}: {
	hasResults: boolean;
	onRun: () => void;
	runButtonLabel: string;
	runDisabled: boolean;
	onUpload: () => void;
	onPullCredit: () => void;
	isExtracting: boolean;
	extractionStatus?: string;
	extractionProgress?: number;
	fileNames: string[];
	onCancelExtraction: () => void;
	isCanceling: boolean;
}) {
	if (isExtracting) {
		return (
			<div className="h-full flex items-center justify-center">
				<div className="w-full max-w-lg bg-white rounded-xl border border-slate-200 p-6">
					{/* Header with status and cancel button */}
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<Loader2 className="w-4 h-4 animate-spin text-amber-600" />
							<span className="text-sm font-medium text-amber-700">
								{extractionStatus || "Extracting credit report..."}
							</span>
						</div>
						<button
							onClick={onCancelExtraction}
							disabled={isCanceling}
							className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
							title="Cancel extraction"
						>
							<X className="w-3.5 h-3.5" />
							{isCanceling ? "Canceling..." : "Cancel"}
						</button>
					</div>

					{/* Progress bar */}
					{extractionProgress !== undefined && (
						<div className="h-1.5 bg-amber-100 rounded-full overflow-hidden mb-4">
							<div
								className="h-full bg-amber-500 rounded-full transition-all duration-300"
								style={{ width: `${extractionProgress}%` }}
							/>
						</div>
					)}

					{/* Show uploaded file names */}
					<div className="space-y-2">
						{fileNames.map((filename, idx) => (
							<div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
								<FileText className="w-5 h-5 text-amber-500 animate-pulse" />
								<div className="flex-1 min-w-0">
									<span className="text-sm font-medium text-slate-700 truncate block">
										{filename}
									</span>
									<span className="text-xs text-slate-500">Extracting credit data...</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="h-full flex items-center justify-center text-slate-400">
			<div className="text-center max-w-md">
				<CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
				<p className="text-lg font-medium">
					{hasResults ? "No Borrower Credit Report Data" : "No Credit Data"}
				</p>
				<p className="text-sm mt-1">
					{hasResults
						? "Credit verification completed, but no borrower-level credit report fields were found."
						: "Upload a credit report or run credit verification to generate data for this case."}
				</p>
				<div className="mt-5 flex items-center justify-center gap-3">
					<button
						onClick={onUpload}
						className="px-4 py-2.5 rounded-lg font-semibold transition-colors bg-orange-600 text-white hover:bg-orange-700 inline-flex items-center gap-2"
					>
						<Upload className="w-4 h-4" />
						Upload Credit Report
					</button>
					<button
						onClick={onPullCredit}
						className="px-4 py-2.5 rounded-lg font-semibold transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2"
					>
						<CreditCard className="w-4 h-4" />
						Pull Credit
					</button>
					<button
						onClick={onRun}
						disabled={runDisabled}
						className="px-5 py-2.5 rounded-lg font-semibold transition-colors min-w-[120px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
					>
						{runButtonLabel}
					</button>
				</div>
			</div>
		</div>
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function unwrapValue(value: unknown): unknown {
	// Document extraction fields are often shaped as { field_name, value, bbox }.
	// Unwrap recursively so parsing helpers can consume raw scalar/array/object values.
	let current = value;
	let depth = 0;
	while (isRecord(current) && "value" in current && depth < 4) {
		current = (current as Record<string, unknown>).value;
		depth += 1;
	}
	return current;
}

function toRecord(value: unknown): Record<string, unknown> | null {
	const unwrapped = unwrapValue(value);
	return isRecord(unwrapped) ? unwrapped : null;
}

function toArray(value: unknown): unknown[] {
	const unwrapped = unwrapValue(value);
	return Array.isArray(unwrapped) ? unwrapped : [];
}

function toStringValue(value: unknown): string | undefined {
	const unwrapped = unwrapValue(value);
	if (typeof unwrapped !== "string") return undefined;
	const normalized = unwrapped.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function toNumber(value: unknown): number | undefined {
	const unwrapped = unwrapValue(value);
	if (typeof unwrapped === "number" && Number.isFinite(unwrapped)) return unwrapped;
	if (typeof unwrapped !== "string") return undefined;
	const cleaned = unwrapped.replace(/[,$%]/g, "").trim();
	if (!cleaned) return undefined;
	const parsed = Number(cleaned);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function toBoolean(value: unknown): boolean | undefined {
	const unwrapped = unwrapValue(value);
	if (typeof unwrapped === "boolean") return unwrapped;
	if (typeof unwrapped === "number") return unwrapped !== 0;
	if (typeof unwrapped === "string") {
		const normalized = unwrapped.trim().toLowerCase();
		if (["true", "yes", "y", "1"].includes(normalized)) return true;
		if (["false", "no", "n", "0"].includes(normalized)) return false;
	}
	return undefined;
}

function toDigits(value: unknown): string | undefined {
	const unwrapped = unwrapValue(value);
	if (typeof unwrapped === "number" && Number.isFinite(unwrapped)) {
		const digits = String(Math.trunc(unwrapped)).replace(/\D/g, "");
		return digits.length > 0 ? digits : undefined;
	}
	if (typeof unwrapped !== "string") return undefined;
	const digits = unwrapped.replace(/\D/g, "");
	return digits.length > 0 ? digits : undefined;
}

function toSlug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toDateString(value: unknown, fallback = TODAY_ISO): string {
	const raw = toStringValue(value);
	if (!raw) return fallback;
	const parsed = new Date(raw);
	if (Number.isNaN(parsed.getTime())) return fallback;
	return parsed.toISOString().slice(0, 10);
}

function getPath(source: Record<string, unknown> | null | undefined, path: string[]): unknown {
	let current: unknown = source;
	for (const segment of path) {
		if (!isRecord(current)) return undefined;
		current = current[segment];
	}
	return current;
}

function isCreditReportData(value: unknown): value is CreditReportData {
	if (!isRecord(value)) return false;
	return (
		typeof value.borrowerId === "string" &&
		Array.isArray(value.creditScores) &&
		Array.isArray(value.accounts) &&
		Array.isArray(value.publicRecords) &&
		Array.isArray(value.inquiries)
	);
}

function normalizeBureau(value: unknown): CreditScoreData["bureau"] | undefined {
	const raw = toStringValue(value)?.toLowerCase();
	if (!raw) return undefined;
	if (raw.includes("equifax")) return "Equifax";
	if (raw.includes("experian")) return "Experian";
	if (raw.includes("transunion") || raw.includes("trans_union") || raw.includes("trans union")) {
		return "TransUnion";
	}
	return undefined;
}

function normalizeScoreModel(value: unknown): CreditScoreData["scoreModel"] {
	const raw = toStringValue(value)?.toLowerCase() ?? "";
	if (raw.includes("vantage") && raw.includes("4")) return "VantageScore 4";
	if (raw.includes("fico") && raw.includes("8")) return "FICO Score 8";
	if (raw.includes("fico") && raw.includes("2")) return "FICO Score 2";
	if (raw.includes("fico") && raw.includes("4")) return "FICO Score 4";
	if (raw.includes("fico") && raw.includes("5")) return "FICO Score 5";
	return "OTHER";
}

function normalizeRiskTier(score: number): CreditReportData["riskTier"] {
	if (score >= 700) return "LOW";
	if (score >= 620) return "MODERATE";
	return "HIGH";
}

function normalizeAccountType(value: unknown): LoanAccountData["accountType"] {
	const raw = (toStringValue(value) ?? "").toLowerCase();
	if (raw.includes("collection")) return "COLLECTION";
	if (raw.includes("mortgage") || raw.includes("real estate") || raw.includes("home"))
		return "MORTGAGE";
	if (raw.includes("auto")) return "AUTO_LOAN";
	if (raw.includes("student") || raw.includes("education")) return "STUDENT_LOAN";
	if (raw.includes("heloc")) return "HELOC";
	if (raw.includes("line of credit") || raw.includes("line_of_credit")) return "LINE_OF_CREDIT";
	if (raw.includes("credit card") || raw.includes("charge")) return "CREDIT_CARD";
	if (raw.includes("personal") || raw.includes("secured") || raw.includes("unsecured"))
		return "PERSONAL_LOAN";
	return "PERSONAL_LOAN";
}

function normalizeAccountStatus(value: unknown): LoanAccountData["status"] {
	const raw = (toStringValue(value) ?? "").toLowerCase();
	if (raw.includes("collection")) return "COLLECTION";
	if (raw.includes("paid")) return "PAID";
	if (raw.includes("close")) return "CLOSED";
	if (raw.includes("open") || raw.includes("active") || raw.includes("current")) return "OPEN";
	return "OPEN";
}

function normalizeResponsibility(value: unknown): LoanAccountData["responsibilityType"] {
	const raw = (toStringValue(value) ?? "").toLowerCase();
	if (raw.includes("joint")) return "JOINT";
	if (raw.includes("authorized")) return "AUTHORIZED_USER";
	if (raw.includes("cosign")) return "COSIGNER";
	return "INDIVIDUAL";
}

function normalizePublicRecordType(value: unknown): PublicRecordData["type"] {
	const raw = (toStringValue(value) ?? "").toLowerCase();
	if (raw.includes("bankruptcy")) return "BANKRUPTCY";
	if (raw.includes("foreclosure")) return "FORECLOSURE";
	if (raw.includes("judgment")) return "JUDGMENT";
	if (raw.includes("lien")) return "TAX_LIEN";
	return "COLLECTION";
}

function normalizePublicRecordStatus(value: unknown): PublicRecordData["status"] {
	const raw = (toStringValue(value) ?? "").toLowerCase();
	if (raw.includes("discharge")) return "DISCHARGED";
	if (raw.includes("dismiss")) return "DISMISSED";
	if (raw.includes("satisfied") || raw.includes("paid")) return "SATISFIED";
	if (raw.includes("close")) return "CLOSED";
	return "OPEN";
}

function normalizeInquiryType(value: unknown): InquiryData["type"] {
	const raw = (toStringValue(value) ?? "").toLowerCase();
	if (raw.includes("mortgage")) return "MORTGAGE";
	if (raw.includes("auto")) return "AUTO_LOAN";
	if (raw.includes("student") || raw.includes("education")) return "STUDENT_LOAN";
	if (raw.includes("heloc")) return "HELOC";
	if (raw.includes("line of credit") || raw.includes("line_of_credit")) return "LINE_OF_CREDIT";
	if (raw.includes("personal")) return "PERSONAL_LOAN";
	return "CREDIT_CARD";
}

function normalizePaymentHistory(value: unknown): string {
	if (typeof value === "string") {
		const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
		return cleaned || "D".repeat(24);
	}
	if (Array.isArray(value)) {
		const joined = value
			.map((item) => toStringValue(item)?.charAt(0).toUpperCase() ?? "D")
			.join("");
		return joined || "D".repeat(24);
	}
	return "D".repeat(24);
}

function scoreFactorsFromReasonCodes(reasonCodes: unknown): CreditScoreData["factors"] {
	const reasons: string[] = [];
	for (const item of toArray(reasonCodes)) {
		const raw = toStringValue(item);
		if (!raw) continue;
		const split = raw
			.split("|")
			.map((part) => part.trim())
			.filter(Boolean);
		if (split.length > 0) {
			reasons.push(...split);
		} else {
			reasons.push(raw);
		}
	}

	return Array.from(new Set(reasons)).map((reason) => ({
		code: reason,
		description: reason,
		impact: "NEGATIVE" as const,
	}));
}

function extractScores(source: Record<string, unknown>): CreditScoreData[] {
	const directScores = toArray(source.creditScores)
		.filter(isRecord)
		.map((scoreObj): CreditScoreData | null => {
			const bureau = normalizeBureau(scoreObj.bureau);
			const score = toNumber(scoreObj.score);
			if (!bureau || score == null) return null;
			return {
				bureau,
				score,
				scoreModel: normalizeScoreModel(scoreObj.scoreModel),
				scoreDate: toDateString(scoreObj.scoreDate, TODAY_ISO),
				factors: toArray(scoreObj.factors)
					.filter(isRecord)
					.map((factor) => ({
						code: toStringValue(factor.code) ?? "factor",
						description:
							toStringValue(factor.description) ?? toStringValue(factor.code) ?? "Factor",
						impact: (toStringValue(factor.impact)?.toUpperCase() === "POSITIVE"
							? "POSITIVE"
							: "NEGATIVE") as "POSITIVE" | "NEGATIVE",
					})),
			};
		})
		.filter((item): item is CreditScoreData => item !== null);

	if (directScores.length > 0) return directScores;

	const scores: CreditScoreData[] = [];
	const reports = toRecord(source.reports);

	if (reports) {
		for (const [bureauKey, bureauRaw] of Object.entries(reports)) {
			const bureau = normalizeBureau(bureauKey);
			const bureauRecord = toRecord(bureauRaw);
			if (!bureau || !bureauRecord) continue;

			const fullFeed = toRecord(bureauRecord.full_feed) ?? bureauRecord;
			const scoreRoot = toRecord(fullFeed.credit_score) ?? toRecord(fullFeed.credit_scores) ?? {};

			const scoreCandidates: Array<{ key: string; model: CreditScoreData["scoreModel"] }> = [
				{ key: "fico_8", model: "FICO Score 8" },
				{ key: "fico8", model: "FICO Score 8" },
				{ key: "fico_5", model: "FICO Score 5" },
				{ key: "fico5", model: "FICO Score 5" },
				{ key: "fico_4", model: "FICO Score 4" },
				{ key: "fico4", model: "FICO Score 4" },
				{ key: "fico_2", model: "FICO Score 2" },
				{ key: "fico2", model: "FICO Score 2" },
				{ key: "vantage_4", model: "VantageScore 4" },
			];

			for (const candidate of scoreCandidates) {
				const rawScoreContainer = toRecord(scoreRoot[candidate.key]);
				const score =
					toNumber(rawScoreContainer?.score) ??
					toNumber(scoreRoot[`${candidate.key}_score`]) ??
					toNumber(scoreRoot[candidate.key]);
				if (score == null || score <= 0) continue;
				const reasonCodes =
					rawScoreContainer?.reason_codes ?? scoreRoot[`${candidate.key}_reason_codes`] ?? [];
				scores.push({
					bureau,
					score,
					scoreModel: candidate.model,
					scoreDate: toDateString(fullFeed.report_date ?? source.report_date, TODAY_ISO),
					factors: scoreFactorsFromReasonCodes(reasonCodes),
				});
			}
		}
	}

	if (scores.length > 0) return scores;

	const creditScores = toRecord(source.credit_scores);
	const bureau =
		normalizeBureau(source.bureau) ?? normalizeBureau(source.bureau_name) ?? "Experian";

	const fallbackCandidates: Array<{ key: string; model: CreditScoreData["scoreModel"] }> = [
		{ key: "fico_8", model: "FICO Score 8" },
		{ key: "fico_5", model: "FICO Score 5" },
		{ key: "fico_4", model: "FICO Score 4" },
		{ key: "fico_2", model: "FICO Score 2" },
		{ key: "vantage_4", model: "VantageScore 4" },
	];

	const fallbackScores: CreditScoreData[] = [];
	for (const candidate of fallbackCandidates) {
		const scoreObj = creditScores ? toRecord(creditScores[candidate.key]) : null;
		const score =
			toNumber(scoreObj?.score) ??
			(creditScores ? toNumber(creditScores[`${candidate.key}_score`]) : undefined) ??
			(creditScores ? toNumber(creditScores[candidate.key]) : undefined) ??
			toNumber(source[`${candidate.key}_score`]) ??
			toNumber(source[candidate.key]);
		if (score == null || score <= 0) continue;
		const reasonCodes =
			scoreObj?.reason_codes ??
			(creditScores ? creditScores[`${candidate.key}_reason_codes`] : undefined) ??
			source[`${candidate.key}_reason_codes`] ??
			[];
		fallbackScores.push({
			bureau,
			score,
			scoreModel: candidate.model,
			scoreDate: toDateString(source.report_date, TODAY_ISO),
			factors: scoreFactorsFromReasonCodes(reasonCodes),
		});
	}

	return fallbackScores;
}

function isLikelyTradeAccountRecord(value: Record<string, unknown>): boolean {
	return (
		"account_number" in value ||
		"accountNumber" in value ||
		"company" in value ||
		"creditor_name" in value ||
		"subscriber" in value ||
		"account_type" in value ||
		"portfolio_type" in value ||
		"balance" in value ||
		"monthly_payment_amount" in value ||
		"monthly_payment_account" in value
	);
}

function isLikelyCollectionRecord(value: Record<string, unknown>): boolean {
	return (
		"creditor" in value ||
		"creditor_name" in value ||
		"company" in value ||
		"subscriber" in value ||
		"account_number" in value ||
		"balance" in value ||
		"amount" in value
	);
}

function collectMatchingRecords(
	value: unknown,
	out: Record<string, unknown>[],
	predicate: (entry: Record<string, unknown>) => boolean,
): void {
	if (Array.isArray(value)) {
		for (const item of value) {
			collectMatchingRecords(item, out, predicate);
		}
		return;
	}
	if (!isRecord(value)) return;

	if (predicate(value)) {
		out.push(value);
	}

	for (const nested of Object.values(value)) {
		collectMatchingRecords(nested, out, predicate);
	}
}

function collectTradeAccountRecords(source: Record<string, unknown>): Record<string, unknown>[] {
	const records: Record<string, unknown>[] = [];

	const pushTradeRecords = (value: unknown) =>
		collectMatchingRecords(value, records, isLikelyTradeAccountRecord);

	pushTradeRecords(source.trade_accounts);
	pushTradeRecords(source.tradeAccounts);
	pushTradeRecords(source.accounts);
	pushTradeRecords(source.tradelines);
	pushTradeRecords(source.trade_accounts_by_type);
	pushTradeRecords(source.tradeAccountsByType);
	pushTradeRecords(getPath(source, ["calculated", "credit_liabilities", "accounts_by_type"]));
	pushTradeRecords(
		getPath(source, ["output", "credit_assessment", "liabilities", "accounts_by_type"]),
	);
	pushTradeRecords(getPath(source, ["credit_assessment", "liabilities", "accounts_by_type"]));
	pushTradeRecords(getPath(source, ["calculated", "by_borrower"]));
	pushTradeRecords(source.reports);

	return records;
}

function collectCollectionRecords(source: Record<string, unknown>): Record<string, unknown>[] {
	const records: Record<string, unknown>[] = [];

	const pushCollectionRecords = (value: unknown) =>
		collectMatchingRecords(value, records, isLikelyCollectionRecord);

	pushCollectionRecords(source.collections);
	pushCollectionRecords(source.collection_accounts);
	pushCollectionRecords(source.reports);
	pushCollectionRecords(getPath(source, ["calculated", "credit_liabilities", "collections"]));
	pushCollectionRecords(getPath(source, ["output", "credit_assessment", "collections"]));

	return records;
}

function extractAccounts(source: Record<string, unknown>): LoanAccountData[] {
	const tradeAccounts = collectTradeAccountRecords(source);
	const collections = collectCollectionRecords(source);
	const accounts: LoanAccountData[] = [];
	const seen = new Set<string>();

	const pushAccount = (rawAccount: Record<string, unknown>, forcedCollection = false) => {
		const creditorName =
			toStringValue(rawAccount.company) ??
			toStringValue(rawAccount.creditor_name) ??
			toStringValue(rawAccount.creditorName) ??
			toStringValue(rawAccount.subscriber) ??
			toStringValue(rawAccount.creditor) ??
			"Unknown Creditor";
		const accountNumber =
			toStringValue(rawAccount.account_number) ??
			toStringValue(rawAccount.accountNumber) ??
			toStringValue(rawAccount.account_no) ??
			toStringValue(rawAccount.account_id) ??
			`unknown-${accounts.length + 1}`;
		const accountType = forcedCollection
			? ("COLLECTION" as LoanAccountData["accountType"])
			: normalizeAccountType(
					rawAccount.account_type_category ??
						rawAccount.account_type ??
						rawAccount.portfolio_type ??
						rawAccount.account_category,
				);
		const status = forcedCollection
			? ("COLLECTION" as LoanAccountData["status"])
			: normalizeAccountStatus(rawAccount.account_status ?? rawAccount.status);
		const accountId =
			toStringValue(rawAccount.account_id) ??
			`${creditorName}-${accountNumber}-${accountType}`.toLowerCase().replace(/\s+/g, "-");
		if (seen.has(accountId)) return;
		seen.add(accountId);

		const currentBalance =
			toNumber(rawAccount.current_balance) ??
			toNumber(rawAccount.balance) ??
			toNumber(rawAccount.terms_balance) ??
			toNumber(rawAccount.balance_due_amount) ??
			toNumber(rawAccount.amount) ??
			0;
		const monthlyPayment =
			toNumber(rawAccount.monthly_payment_amount) ??
			toNumber(rawAccount.monthly_payment) ??
			toNumber(rawAccount.reported_payment) ??
			toNumber(rawAccount.payment) ??
			toNumber(rawAccount.calculated_payment) ??
			0;
		const dtiPayment =
			toNumber(rawAccount.dti_payment) ?? toNumber(rawAccount.calculated_payment) ?? monthlyPayment;
		const includeInDti =
			toBoolean(rawAccount.include_in_dti) ??
			toBoolean(rawAccount.includeInDti) ??
			(forcedCollection ? false : dtiPayment > 0);

		const openDate = toDateString(
			rawAccount.date_of_opening ??
				rawAccount.open_date ??
				rawAccount.opened_date ??
				rawAccount.openDate,
			"2000-01-01",
		);

		const responsibilityType = normalizeResponsibility(
			rawAccount.responsibility ?? rawAccount.responsibility_type ?? rawAccount.ownership,
		);

		const account: LoanAccountData = {
			accountId,
			accountType,
			creditorName,
			accountNumber,
			originalAmount:
				toNumber(rawAccount.original_loan_amount) ??
				toNumber(rawAccount.terms_original_loan_amount) ??
				toNumber(rawAccount.original_amount) ??
				toNumber(rawAccount.high_credit) ??
				toNumber(rawAccount.terms_high_credit) ??
				currentBalance,
			currentBalance,
			highBalance:
				toNumber(rawAccount.high_credit) ??
				toNumber(rawAccount.terms_high_balance_amount) ??
				toNumber(rawAccount.terms_high_credit),
			creditLimit: toNumber(rawAccount.credit_limit) ?? toNumber(rawAccount.terms_high_credit),
			monthlyPayment,
			interestInfo: (() => {
				const rate =
					toNumber(rawAccount.interest_rate) ??
					toNumber(rawAccount.rate) ??
					toNumber(rawAccount.apr);
				if (rate == null) return undefined;
				const rateTypeRaw = toStringValue(rawAccount.rate_type)?.toLowerCase();
				return {
					rate,
					type: rateTypeRaw === "variable" ? ("VARIABLE" as const) : ("FIXED" as const),
				};
			})(),
			termMonths: toNumber(rawAccount.term_months),
			status,
			responsibilityType,
			openDate,
			closedDate: toStringValue(rawAccount.date_of_closure ?? rawAccount.closure_date)
				? toDateString(rawAccount.date_of_closure ?? rawAccount.closure_date, openDate)
				: undefined,
			paymentHistory: normalizePaymentHistory(rawAccount.payment_history),
			includeInDti,
			dtiPayment: includeInDti ? dtiPayment : 0,
			dtiNote:
				toStringValue(rawAccount.dti_note) ??
				toStringValue(rawAccount.note) ??
				(forcedCollection ? "Collection account" : undefined),
			collateral: toStringValue(rawAccount.collateral),
			reportedBy: (() => {
				const bureauList = toArray(rawAccount.reported_by)
					.map((item) => normalizeBureau(item))
					.filter((item): item is CreditScoreData["bureau"] => Boolean(item));
				return bureauList.length > 0 ? bureauList : ["Equifax", "Experian", "TransUnion"];
			})(),
		};

		accounts.push(account);
	};

	for (const tradeAccount of tradeAccounts) {
		pushAccount(tradeAccount, false);
	}
	for (const collection of collections) {
		pushAccount(collection, true);
	}

	return accounts;
}

function extractPublicRecords(source: Record<string, unknown>): PublicRecordData[] {
	const records: PublicRecordData[] = [];
	const pushRawRecords = (value: unknown) => {
		for (const item of toArray(value)) {
			if (!isRecord(item)) continue;
			records.push({
				type: normalizePublicRecordType(item.type ?? item.record_type),
				status: normalizePublicRecordStatus(item.status ?? item.record_status),
				amount: toNumber(item.amount ?? item.balance),
				date: toDateString(item.date ?? item.date_filed, TODAY_ISO),
				detail: toStringValue(item.detail ?? item.description ?? item.creditor),
			});
		}
	};

	pushRawRecords(source.public_records);
	pushRawRecords(source.publicRecords);

	const reports = toRecord(source.reports);
	if (reports) {
		for (const reportRaw of Object.values(reports)) {
			const report = toRecord(reportRaw);
			if (!report) continue;
			const fullFeed = toRecord(report.full_feed) ?? report;
			pushRawRecords(fullFeed.public_records);
		}
	}

	return records;
}

function extractInquiries(source: Record<string, unknown>): InquiryData[] {
	const inquiries: InquiryData[] = [];
	const pushRawInquiries = (value: unknown, bureauHint?: CreditScoreData["bureau"]) => {
		for (const item of toArray(value)) {
			if (!isRecord(item)) continue;
			const bureauCandidates = toArray(item.bureau ?? item.bureaus)
				.map((candidate) => normalizeBureau(candidate))
				.filter((candidate): candidate is CreditScoreData["bureau"] => Boolean(candidate));
			const bureau: InquiryData["bureau"] =
				bureauCandidates.length > 0 ? bureauCandidates : bureauHint ? [bureauHint] : ["Experian"];
			inquiries.push({
				creditor:
					toStringValue(item.creditor ?? item.company ?? item.subscriber) ?? "Unknown Creditor",
				date: toDateString(item.date ?? item.inquiry_date, TODAY_ISO),
				type: normalizeInquiryType(item.type ?? item.inquiry_type ?? item.purpose),
				bureau,
			});
		}
	};

	pushRawInquiries(source.inquiries);
	pushRawInquiries(source.credit_inquiries);

	const reports = toRecord(source.reports);
	if (reports) {
		for (const [bureauKey, reportRaw] of Object.entries(reports)) {
			const bureauHint = normalizeBureau(bureauKey);
			const report = toRecord(reportRaw);
			if (!report) continue;
			const fullFeed = toRecord(report.full_feed) ?? report;
			pushRawInquiries(fullFeed.inquiries, bureauHint);
		}
	}

	return inquiries;
}

function buildCandidatesFromBorrowerSections(
	party: Record<string, unknown>,
): Record<string, unknown>[] {
	const sections = toArray(party.sections).filter(isRecord);
	if (sections.length === 0) return [];

	const candidates: Record<string, unknown>[] = [];

	for (const section of sections) {
		const evidenceRaw = toRecord(section.evidence_raw);
		if (evidenceRaw) {
			candidates.push({
				...evidenceRaw,
				borrower_name: toStringValue(party.name),
				borrower_role: toStringValue(party.role),
			});
			continue;
		}
		const aggregateValues = toRecord(getPath(section, ["aggregate", "values"]));
		if (aggregateValues) {
			candidates.push({
				...aggregateValues,
				borrower_name: toStringValue(party.name),
				borrower_role: toStringValue(party.role),
			});
		}
	}

	return candidates;
}

function collectCreditCandidates(
	response: GetCreditVerificationResponse,
): Record<string, unknown>[] {
	const roots: Record<string, unknown>[] = [];
	const candidates: Record<string, unknown>[] = [];

	if (isRecord(response.credit_verification)) {
		roots.push(response.credit_verification);
	}

	if (response.primary_product_id && response.credit_verifications) {
		const primary = response.credit_verifications[response.primary_product_id];
		if (isRecord(primary)) {
			roots.push(primary);
			const nested = toRecord(primary.credit_verification);
			if (nested) roots.push(nested);
		}
	}

	if (response.credit_verifications) {
		for (const value of Object.values(response.credit_verifications)) {
			if (!isRecord(value)) continue;
			roots.push(value);
			const nested = toRecord(value.credit_verification);
			if (nested) roots.push(nested);
		}
	}

	// Prefer borrower section evidence when present.
	// Root-level objects often contain nested copies of the same data and can
	// generate synthetic borrowers with partial fields.
	const partySectionCandidates: Record<string, unknown>[] = [];
	for (const root of roots) {
		const parties = toArray(root.parties).filter(isRecord);
		for (const party of parties) {
			const builtCandidates = buildCandidatesFromBorrowerSections(party);
			for (const built of builtCandidates) {
				partySectionCandidates.push(built);
			}
		}
	}
	if (partySectionCandidates.length > 0) {
		return partySectionCandidates;
	}

	// Fallback: Check for claims.credit at API response root level.
	// Backend specs write claims.credit at execution root, not nested inside credit_verification.
	const responseRecord = response as unknown as Record<string, unknown>;
	const rootClaimsCredit = toRecord(getPath(responseRecord, ["claims", "credit"]));
	if (rootClaimsCredit) {
		const rootFeed = toRecord(getPath(rootClaimsCredit, ["isoftpull_feed"]));
		if (rootFeed) {
			roots.push(rootFeed);
			const rootReports = toRecord(getPath(rootFeed, ["reports"]));
			if (rootReports) {
				// Push each bureau's full_feed as a candidate
				for (const [bureauKey, bureauValue] of Object.entries(rootReports)) {
					const bureauRecord = toRecord(bureauValue);
					if (bureauRecord) {
						const fullFeed = toRecord(bureauRecord.full_feed) ?? bureauRecord;
						roots.push({ ...fullFeed, bureau: bureauKey });
					}
				}
			}
		}
	}

	const pushCandidate = (value: unknown) => {
		if (isRecord(value)) candidates.push(value);
	};

	const pushCandidatesFromArray = (value: unknown) => {
		for (const item of toArray(value)) {
			pushCandidate(item);
		}
	};

	for (const root of roots) {
		pushCandidate(root);
		pushCandidatesFromArray(root.borrowers);
		pushCandidatesFromArray(root.borrower_reports);
		pushCandidatesFromArray(root.reports);

		const claimsCredit = toRecord(getPath(root, ["claims", "credit"]));
		if (claimsCredit) {
			pushCandidate(claimsCredit);
			const feed = toRecord(getPath(claimsCredit, ["isoftpull_feed"]));
			if (feed) pushCandidate(feed);
			const reports = toRecord(getPath(feed, ["reports"]));
			if (reports) {
				pushCandidate({
					...root,
					reports,
				});
			}
		}
	}

	return candidates;
}

function collectCanonicalBorrowers(
	response: GetCreditVerificationResponse,
): Record<string, unknown>[] {
	const borrowers: Record<string, unknown>[] = [];

	const pushBorrowers = (value: unknown) => {
		for (const item of toArray(value)) {
			if (isRecord(item)) {
				borrowers.push(item);
			}
		}
	};

	if (isRecord(response.credit_verification)) {
		pushBorrowers(response.credit_verification.borrowers);
	}

	if (response.primary_product_id && response.credit_verifications) {
		const primary = response.credit_verifications[response.primary_product_id];
		if (isRecord(primary)) {
			pushBorrowers(primary.borrowers);
			const nested = toRecord(primary.credit_verification);
			if (nested) pushBorrowers(nested.borrowers);
		}
	}

	if (response.credit_verifications) {
		for (const payload of Object.values(response.credit_verifications)) {
			if (!isRecord(payload)) continue;
			pushBorrowers(payload.borrowers);
			const nested = toRecord(payload.credit_verification);
			if (nested) pushBorrowers(nested.borrowers);
		}
	}

	return borrowers;
}

function scoreMedian(scores: CreditScoreData[]): number {
	if (scores.length === 0) return 0;
	const ordered = [...scores].map((item) => item.score).sort((a, b) => a - b);
	const mid = Math.floor(ordered.length / 2);
	return ordered.length % 2 ? ordered[mid] : Math.round((ordered[mid - 1] + ordered[mid]) / 2);
}

function utilizationPercent(accounts: LoanAccountData[]): number | null {
	const revolvingAccounts = accounts.filter((account) =>
		["CREDIT_CARD", "LINE_OF_CREDIT", "HELOC"].includes(account.accountType),
	);
	const totalLimit = revolvingAccounts.reduce(
		(sum, account) => sum + (account.creditLimit ?? 0),
		0,
	);
	if (totalLimit <= 0) return null;
	const totalBalance = revolvingAccounts.reduce((sum, account) => sum + account.currentBalance, 0);
	return totalBalance / totalLimit;
}

function inferRole(value: unknown): CreditReportData["role"] {
	const roleRaw = toStringValue(value)?.toLowerCase() ?? "";
	return roleRaw.includes("co") ? "co_borrower" : "primary";
}

function buildBorrowerFromCandidate(
	candidate: Record<string, unknown>,
	index: number,
): CreditReportData | null {
	const personal =
		toRecord(candidate.personal_information) ??
		toRecord(candidate.borrower) ??
		toRecord(candidate.borrower_info) ??
		{};
	const address = toRecord(candidate.current_address) ?? toRecord(candidate.address) ?? {};
	const employment = toRecord(candidate.employment) ?? {};

	const firstName =
		toStringValue(personal.first_name) ??
		toStringValue(candidate.first_name) ??
		toStringValue(candidate.firstName);
	const lastName =
		toStringValue(personal.last_name) ??
		toStringValue(candidate.last_name) ??
		toStringValue(candidate.lastName);
	const fullName = toStringValue(candidate.borrower_name) ?? toStringValue(candidate.name);

	const resolvedFirstName = firstName ?? fullName?.split(" ")[0] ?? "Borrower";
	const resolvedLastName = lastName ?? fullName?.split(" ").slice(1).join(" ") ?? `${index + 1}`;

	const rawSsn =
		toStringValue(personal.ssn) ??
		toStringValue(candidate.ssn) ??
		toStringValue(personal.ssn_last4) ??
		toStringValue(candidate.ssn_last4);
	const ssnDigits = toDigits(rawSsn);
	const ssn = rawSsn ?? (ssnDigits ? `XXX-XX-${ssnDigits.slice(-4)}` : "XXX-XX-0000");

	const scores = extractScores(candidate);
	const accounts = extractAccounts(candidate);
	const publicRecords = extractPublicRecords(candidate);
	const inquiries = extractInquiries(candidate);

	// Guard: Skip candidates with no actual credit data
	// This prevents synthetic "Borrower 1", "Borrower 2" from empty response objects
	if (
		scores.length === 0 &&
		accounts.length === 0 &&
		publicRecords.length === 0 &&
		inquiries.length === 0
	) {
		return null;
	}

	const medianScore = scoreMedian(scores);
	const utilization = utilizationPercent(accounts);

	const positiveFactors: string[] = [];
	if (medianScore > 0) {
		positiveFactors.push(`Credit score ${medianScore}`);
	}
	if (publicRecords.length === 0) {
		positiveFactors.push("No public records");
	}
	if ((utilization ?? 1) < 0.3 && utilization != null) {
		positiveFactors.push(`Low credit utilization (${(utilization * 100).toFixed(1)}%)`);
	}

	const negativeFactors: string[] = [];
	if (publicRecords.length > 0) {
		negativeFactors.push(`${publicRecords.length} public record(s) found`);
	}
	const collectionCount = accounts.filter((account) => account.accountType === "COLLECTION").length;
	if (collectionCount > 0) {
		negativeFactors.push(`${collectionCount} collection account(s)`);
	}
	if ((utilization ?? 0) > 0.5) {
		negativeFactors.push(`High credit utilization (${((utilization ?? 0) * 100).toFixed(1)}%)`);
	}

	const resolvedDob = toDateString(
		personal.date_of_birth ?? candidate.date_of_birth ?? candidate.dateOfBirth,
		"1970-01-01",
	);
	const normalizedName = toSlug(`${resolvedFirstName} ${resolvedLastName}`.trim());

	const borrowerId =
		toStringValue(candidate.borrower_id) ??
		toStringValue(candidate.borrowerId) ??
		(toStringValue(candidate.party_id) ? `party-${candidate.party_id}` : undefined) ??
		(ssnDigits ? `ssn-${ssnDigits.slice(-4)}` : undefined) ??
		(normalizedName ? `name-${normalizedName}-${resolvedDob}` : undefined) ??
		`borrower-${index + 1}`;

	return {
		borrowerId,
		role: inferRole(candidate.borrower_role ?? candidate.role),
		ssn,
		firstName: resolvedFirstName,
		middleName:
			toStringValue(personal.middle_name) ??
			toStringValue(candidate.middle_name) ??
			toStringValue(candidate.middleName),
		lastName: resolvedLastName || "Borrower",
		dateOfBirth: resolvedDob,
		currentAddress: {
			street:
				toStringValue(address.street) ??
				toStringValue(address.address_line_1) ??
				toStringValue(address.line1) ??
				"Unknown",
			city: toStringValue(address.city) ?? "Unknown",
			state: toStringValue(address.state) ?? "NA",
			zip:
				toStringValue(address.zip) ??
				toStringValue(address.zip_code) ??
				toStringValue(address.postal_code) ??
				"00000",
			residenceType: "OTHER",
			monthsAtAddress: toNumber(address.months_at_address) ?? 0,
		},
		addressHistory: [],
		employer:
			toStringValue(employment.employer) ??
			toStringValue(candidate.employer) ??
			toStringValue(employment.company) ??
			"Unknown",
		position:
			toStringValue(employment.position) ??
			toStringValue(employment.job_title) ??
			toStringValue(candidate.position) ??
			"Unknown",
		creditScores: scores,
		accounts,
		publicRecords,
		inquiries,
		riskTier: normalizeRiskTier(medianScore),
		positiveFactors,
		negativeFactors,
		reportDate: toDateString(candidate.report_date, TODAY_ISO),
		reportId:
			toStringValue(candidate.report_id) ??
			toStringValue(candidate.reportId) ??
			`credit-${borrowerId}`,
	};
}

function mergeBorrowers(existing: CreditReportData, incoming: CreditReportData): CreditReportData {
	const scoreKey = (score: CreditScoreData) =>
		`${score.bureau}|${score.scoreModel}|${score.scoreDate}|${score.score}`;
	const scoreByBureau = new Map(existing.creditScores.map((score) => [scoreKey(score), score]));
	for (const score of incoming.creditScores) {
		const key = scoreKey(score);
		if (!scoreByBureau.has(key)) {
			scoreByBureau.set(key, score);
		}
	}

	const accountById = new Map(existing.accounts.map((account) => [account.accountId, account]));
	for (const account of incoming.accounts) {
		if (!accountById.has(account.accountId)) {
			accountById.set(account.accountId, account);
		}
	}

	const publicRecordKey = (record: PublicRecordData) =>
		`${record.type}|${record.date}|${record.amount ?? 0}`;
	const recordMap = new Map(
		existing.publicRecords.map((record) => [publicRecordKey(record), record]),
	);
	for (const record of incoming.publicRecords) {
		const key = publicRecordKey(record);
		if (!recordMap.has(key)) {
			recordMap.set(key, record);
		}
	}

	const inquiryKey = (inquiry: InquiryData) =>
		`${inquiry.creditor}|${inquiry.date}|${inquiry.type}`;
	const inquiryMap = new Map(existing.inquiries.map((inquiry) => [inquiryKey(inquiry), inquiry]));
	for (const inquiry of incoming.inquiries) {
		const key = inquiryKey(inquiry);
		if (!inquiryMap.has(key)) {
			inquiryMap.set(key, inquiry);
		}
	}

	const tierWeight: Record<CreditReportData["riskTier"], number> = {
		LOW: 1,
		MODERATE: 2,
		HIGH: 3,
	};

	return {
		...existing,
		role: existing.role === "primary" ? existing.role : incoming.role,
		ssn: existing.ssn !== "XXX-XX-0000" ? existing.ssn : incoming.ssn,
		firstName: existing.firstName !== "Borrower" ? existing.firstName : incoming.firstName,
		lastName: existing.lastName !== "1" ? existing.lastName : incoming.lastName,
		employer: existing.employer !== "Unknown" ? existing.employer : incoming.employer,
		position: existing.position !== "Unknown" ? existing.position : incoming.position,
		reportDate: existing.reportDate || incoming.reportDate,
		reportId: existing.reportId || incoming.reportId,
		creditScores: Array.from(scoreByBureau.values()),
		accounts: Array.from(accountById.values()),
		publicRecords: Array.from(recordMap.values()),
		inquiries: Array.from(inquiryMap.values()),
		positiveFactors: Array.from(
			new Set([...existing.positiveFactors, ...incoming.positiveFactors]),
		),
		negativeFactors: Array.from(
			new Set([...existing.negativeFactors, ...incoming.negativeFactors]),
		),
		riskTier:
			tierWeight[incoming.riskTier] > tierWeight[existing.riskTier]
				? incoming.riskTier
				: existing.riskTier,
	};
}

function extractBorrowersFromCreditResult(
	response: GetCreditVerificationResponse,
): CreditReportData[] {
	const directBorrowers = collectCanonicalBorrowers(response);
	const candidates =
		directBorrowers.length > 0 ? directBorrowers : collectCreditCandidates(response);
	const borrowerMap = new Map<string, CreditReportData>();

	for (let index = 0; index < candidates.length; index += 1) {
		const candidate = candidates[index];
		const parsed = isCreditReportData(candidate)
			? candidate
			: buildBorrowerFromCandidate(candidate, index);
		if (!parsed) continue;

		const existing = borrowerMap.get(parsed.borrowerId);
		if (existing) {
			borrowerMap.set(parsed.borrowerId, mergeBorrowers(existing, parsed));
		} else {
			borrowerMap.set(parsed.borrowerId, parsed);
		}
	}

	return Array.from(borrowerMap.values());
}

export function CreditTab({ caseId, onStartVerification }: CreditTabProps) {
	const adaptiveRefetchInterval = useAdaptiveRefetchInterval();
	const { invalidateAll, invalidateWorkflows, invalidateCredit, invalidateStatus } =
		useCaseQueryInvalidation();
	const {
		data: creditResult,
		isLoading,
		isError,
		error: queryError,
		refetch,
	} = useCreditVerification(caseId);

	const [startError, setStartError] = useState<string | null>(null);
	const [isStartingVerification, setIsStartingVerification] = useState(false);
	const [selectedBorrowerId, setSelectedBorrowerId] = useState<string>("");
	const [activeSubTab, setActiveSubTab] = useState<SubTab>("accounts");
	const [showUploadModal, setShowUploadModal] = useState(false);
	const [showPullCreditModal, setShowPullCreditModal] = useState(false);
	const [isCanceling, setIsCanceling] = useState(false);
	const [creditPullWorkflowId, setCreditPullWorkflowId] = useState<string | null>(null);

	// Upload state machine
	const [uploadState, setUploadState] = useState<UploadState>({
		phase: "idle",
		fileNames: [],
	});

	const isExtracting = uploadState.phase === "extracting";

	// Fetch case status for progress info (poll faster when extracting)
	const { data: caseStatus } = useCaseStatus(caseId, {
		refetchInterval: isExtracting || !!creditPullWorkflowId ? 2000 : adaptiveRefetchInterval,
	});
	const { data: workflowStatus } = useWorkflowStatus(caseId, {
		enabled: true,
		refetchInterval: isExtracting || !!creditPullWorkflowId ? 2000 : adaptiveRefetchInterval,
	});
	const creditWorkflow = workflowStatus?.workflows.find(
		(workflow) => workflow.workflow_type === "credit",
	);
	const isCreditWorkflowRunning = creditWorkflow?.status === "running";

	// Check for running add-files workflows
	const addFilesWorkflowRunning = useMemo(() => {
		if (!workflowStatus?.workflows) return false;
		return workflowStatus.workflows.some(
			(wf) => wf.workflow_type === "add_files" && wf.status === "running",
		);
	}, [workflowStatus]);

	// Track workflow completion
	const prevAddFilesRunningRef = useRef(false);

	useEffect(() => {
		const wasRunning = prevAddFilesRunningRef.current;
		const isRunning = addFilesWorkflowRunning;
		prevAddFilesRunningRef.current = isRunning;

		// Workflow just completed: extracting → idle, refetch data
		if (wasRunning && !isRunning && uploadState.phase === "extracting") {
			invalidateCredit(caseId);
			invalidateAll(caseId);
			setUploadState({ phase: "idle", fileNames: [] });
		}
	}, [addFilesWorkflowRunning, uploadState.phase, caseId, invalidateAll, invalidateCredit]);

	const handleUploadComplete = useCallback(
		(fileNames: string[]) => {
			// Transition to extracting phase
			setUploadState({
				phase: "extracting",
				fileNames,
			});
			setShowUploadModal(false);
			// Start polling for updates
			invalidateCredit(caseId);
			invalidateWorkflows(caseId);
		},
		[caseId, invalidateCredit, invalidateWorkflows],
	);

	const handleCancelExtraction = useCallback(async () => {
		if (isCanceling) return;
		setIsCanceling(true);
		try {
			await cancelWorkflows(caseId, ["AUEAddFilesWorkflow"]);
			setUploadState({ phase: "idle", fileNames: [] });
			invalidateStatus(caseId);
			invalidateWorkflows(caseId);
		} catch (err) {
			console.error("Failed to cancel workflow:", err);
		} finally {
			setIsCanceling(false);
		}
	}, [caseId, isCanceling, invalidateStatus, invalidateWorkflows]);

	const { data: creditPullStatus } = useCreditPullStatus(caseId, creditPullWorkflowId, {
		enabled: !!creditPullWorkflowId,
		refetchInterval: creditPullWorkflowId ? 2000 : false,
	});

	// Cancel credit pull workflow
	const handleCancelCreditPull = useCallback(async () => {
		if (!creditPullWorkflowId || !caseId || isCanceling) return;
		setIsCanceling(true);
		try {
			await api.post(`/api/v1/case/${caseId}/credit/pull/${creditPullWorkflowId}/cancel`, {});
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
		} catch (err) {
			console.error("Failed to cancel credit pull:", err);
		} finally {
			setIsCanceling(false);
		}
	}, [creditPullWorkflowId, caseId, isCanceling]);

	// Handle credit pull workflow status transitions.
	useEffect(() => {
		if (!creditPullWorkflowId || !creditPullStatus) return;
		const status = creditPullStatus.status;

		if (status === "completed") {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
			invalidateCredit(caseId);
			invalidateAll(caseId);
			return;
		}

		if (status === "canceled" || status === "terminated") {
			setCreditPullWorkflowId(null);
			setUploadState({ phase: "idle", fileNames: [] });
			return;
		}

		if (status === "failed" || status.includes("failed") || status.includes("timed_out")) {
			setCreditPullWorkflowId(null);
			setUploadState((prev) => ({
				phase: "error",
				fileNames: prev.fileNames,
				errorMessage: creditPullStatus.error_message || "Credit pull failed. Please try again.",
			}));
		}
	}, [creditPullWorkflowId, creditPullStatus, caseId, invalidateAll, invalidateCredit]);

	// Handle credit pull success (from modal)
	const handleCreditPullSuccess = useCallback((workflowId: string) => {
		// Store workflow ID to start polling
		setCreditPullWorkflowId(workflowId);
		// Transition to extracting state to show progress
		setUploadState({
			phase: "extracting",
			fileNames: ["Pulling credit report..."],
		});
	}, []);

	const borrowers = useMemo(
		() =>
			extractBorrowersFromCreditResult(
				creditResult ?? ({ credit_verification: null } as GetCreditVerificationResponse),
			),
		[creditResult],
	);

	const hasExistingResults = useMemo(
		() =>
			!!creditResult?.credit_verification ||
			!!(
				creditResult?.credit_verifications &&
				Object.keys(creditResult.credit_verifications).length > 0
			),
		[creditResult],
	);

	// Excel download state
	const [excelDownloading, setExcelDownloading] = useState(false);

	const handleExcelDownload = useCallback(async () => {
		setExcelDownloading(true);
		try {
			const { apiRequest } = await import("../../lib/api");
			const response = await apiRequest<{ signed_url: string; filename: string }>(
				`/api/v1/cases/${caseId}/stages/credit/excel-url`,
			);
			window.open(response.signed_url, "_blank");
		} catch (error) {
			console.error("Excel download failed:", error);
		} finally {
			setExcelDownloading(false);
		}
	}, [caseId]);

	const runButtonLabel = useMemo(() => {
		if (isStartingVerification) return "Starting...";
		if (isCreditWorkflowRunning) return "Running...";
		return hasExistingResults ? "Rerun" : "Run";
	}, [hasExistingResults, isCreditWorkflowRunning, isStartingVerification]);

	const startCreditVerification = async () => {
		try {
			setStartError(null);
			setIsStartingVerification(true);
			onStartVerification?.();

			const response = await startCreditVerificationWithOptions(caseId, {
				run_all_products: false,
				result_storage_mode: "combined",
			});

			if (response.status !== "started") {
				setStartError(response.message || "Failed to start credit verification");
				return;
			}

			invalidateWorkflows(caseId);
		} catch (err) {
			setStartError(err instanceof Error ? err.message : "Failed to start credit verification");
		} finally {
			setIsStartingVerification(false);
		}
	};

	// Refetch credit when credit workflow completes
	useEffect(() => {
		if (creditWorkflow?.status === "completed") {
			invalidateCredit(caseId);
		}
	}, [creditWorkflow?.status, caseId, invalidateCredit]);

	// Set initial selected borrower when borrowers load or change
	useEffect(() => {
		if (borrowers.length === 0) return;
		const current = borrowers.find((b) => b.borrowerId === selectedBorrowerId);
		if (current) return;
		const primary = borrowers.find((b) => b.role === "primary");
		setSelectedBorrowerId(primary?.borrowerId ?? borrowers[0].borrowerId);
	}, [borrowers, selectedBorrowerId]);

	const currentBorrower = useMemo(
		() => borrowers.find((borrower) => borrower.borrowerId === selectedBorrowerId) || borrowers[0],
		[borrowers, selectedBorrowerId],
	);

	const counts = useMemo(
		() => ({
			accounts: currentBorrower?.accounts.length || 0,
			publicRecords: currentBorrower?.publicRecords.length || 0,
			inquiries: currentBorrower?.inquiries.length || 0,
		}),
		[currentBorrower],
	);

	if (isLoading) {
		return <CreditTabSkeleton />;
	}

	if (isError) {
		const message =
			queryError instanceof Error ? queryError.message : "An unexpected error occurred";
		return <ErrorState message={message} onRetry={() => refetch()} />;
	}

	if (!currentBorrower || borrowers.length === 0) {
		return (
			<>
				<EmptyState
					hasResults={hasExistingResults}
					onRun={startCreditVerification}
					runButtonLabel={runButtonLabel}
					runDisabled={isStartingVerification || isCreditWorkflowRunning}
					onUpload={() => setShowUploadModal(true)}
					onPullCredit={() => setShowPullCreditModal(true)}
					isExtracting={isExtracting}
					extractionStatus={caseStatus?.message}
					extractionProgress={caseStatus?.progress?.percent}
					fileNames={uploadState.fileNames}
					onCancelExtraction={
						creditPullWorkflowId ? handleCancelCreditPull : handleCancelExtraction
					}
					isCanceling={isCanceling}
				/>
				<UploadModal
					caseId={caseId}
					isOpen={showUploadModal}
					onClose={() => setShowUploadModal(false)}
					onUploadComplete={handleUploadComplete}
				/>
				<PullCreditModal
					caseId={caseId}
					open={showPullCreditModal}
					onClose={() => setShowPullCreditModal(false)}
					onSuccess={handleCreditPullSuccess}
				/>
			</>
		);
	}

	return (
		<div className="h-full overflow-auto p-6">
			<div className="max-w-7xl mx-auto space-y-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div>
							<h1 className="text-2xl font-semibold text-slate-800">Credit Assessment</h1>
							<p className="text-sm text-slate-500 mt-1">FNMA Pre-Approval Assessment</p>
						</div>
						{/* Excel download button - show when results exist */}
						{hasExistingResults && (
							<button
								onClick={handleExcelDownload}
								disabled={excelDownloading}
								className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
								title="Download Excel report"
							>
								{excelDownloading ? (
									<svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle
											className="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											strokeWidth="4"
										/>
										<path
											className="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
										/>
									</svg>
								) : (
									<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
										/>
									</svg>
								)}
								Excel
							</button>
						)}
					</div>

					<div className="flex items-center gap-3">
						<button
							onClick={() => setShowUploadModal(true)}
							disabled={isExtracting}
							className="px-4 py-2.5 rounded-lg font-medium transition-colors bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2"
						>
							<Upload className="w-4 h-4" />
							Upload
						</button>
						<button
							onClick={() => setShowPullCreditModal(true)}
							disabled={isExtracting || !!creditPullWorkflowId}
							className="px-4 py-2.5 rounded-lg font-medium transition-colors border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 inline-flex items-center gap-2"
						>
							<CreditCard className="w-4 h-4" />
							Pull Credit
						</button>
						<button
							onClick={startCreditVerification}
							disabled={isStartingVerification || isCreditWorkflowRunning}
							className="px-5 py-2.5 rounded-lg font-semibold transition-colors min-w-[120px] border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
						>
							{runButtonLabel}
						</button>
						{borrowers.length > 1 && (
							<BorrowerSelector
								borrowers={borrowers}
								selectedId={selectedBorrowerId}
								onSelect={setSelectedBorrowerId}
							/>
						)}
					</div>
				</div>

				{startError && (
					<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
						{startError}
					</div>
				)}

				<div className="flex gap-6">
					<div className="w-64 shrink-0">
						<CreditScorePanel scores={currentBorrower.creditScores} />
					</div>
					<BorrowerInfoCard borrower={currentBorrower} />
				</div>

				<CreditSummaryStats
					accounts={currentBorrower.accounts}
					inquiries={currentBorrower.inquiries}
				/>

				<SubTabNav activeTab={activeSubTab} onTabChange={setActiveSubTab} counts={counts} />

				<div
					className="min-h-[400px]"
					role="tabpanel"
					id={`panel-${activeSubTab}`}
					aria-labelledby={activeSubTab}
				>
					{activeSubTab === "accounts" && <AccountsList accounts={currentBorrower.accounts} />}
					{activeSubTab === "scores" && <ScoresTab scores={currentBorrower.creditScores} />}
					{activeSubTab === "public_records" && (
						<PublicRecordsTab records={currentBorrower.publicRecords} />
					)}
					{activeSubTab === "inquiries" && <InquiriesTab inquiries={currentBorrower.inquiries} />}
				</div>
			</div>

			{/* Upload Modal */}
			<UploadModal
				caseId={caseId}
				isOpen={showUploadModal}
				onClose={() => setShowUploadModal(false)}
				onUploadComplete={handleUploadComplete}
			/>

			{/* Pull Credit Modal */}
			<PullCreditModal
				caseId={caseId}
				open={showPullCreditModal}
				onClose={() => setShowPullCreditModal(false)}
				onSuccess={handleCreditPullSuccess}
			/>
		</div>
	);
}
