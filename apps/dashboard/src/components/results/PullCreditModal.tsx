import { useEffect, useState } from "react";
import { AlertCircle, CreditCard, DollarSign, Loader2, Edit3 } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog";
import { api } from "../../lib/api";
import { useAppConfig } from "../../hooks/useCaseQueries";
import { AddressAutocomplete, type AddressResult } from "../shared";
interface PullCreditModalProps {
	caseId: string;
	borrowerId?: string;
	open: boolean;
	onClose: () => void;
	onSuccess: (workflowId: string) => void;
}

interface CreditPullFormData {
	first_name: string;
	last_name: string;
	address: string;
	city: string;
	state: string;
	zip: string;
	ssn: string;
	date_of_birth: string;
}

function cn(...classes: Array<string | undefined | false | null>): string {
	return classes.filter(Boolean).join(" ");
}

const PULL_CREDIT_DISABLED = true;
const TEST_MODE_DISABLED = true;

const TEST_SSNS = ["111111111", "222222222", "333333333", "444444444", "555555555"];

// iSoftPull test applicants - only used in development mode
const TEST_APPLICANTS: Array<{
	label: string;
	score: string;
	data: CreditPullFormData;
}> = [
	{
		label: "Steve Johnson",
		score: "~700",
		data: {
			first_name: "Steve",
			last_name: "Johnson",
			address: "3557 Lancer Way",
			city: "Carlsbad",
			state: "California",
			zip: "92008",
			ssn: "111111111",
			date_of_birth: "08/15/1980",
		},
	},
	{
		label: "John Dough",
		score: "~600",
		data: {
			first_name: "John",
			last_name: "Dough",
			address: "310 Tamarack Ave",
			city: "Carlsbad",
			state: "California",
			zip: "92010",
			ssn: "222222222",
			date_of_birth: "04/15/1982",
		},
	},
	{
		label: "Susie Que",
		score: "~500",
		data: {
			first_name: "Susie",
			last_name: "Que",
			address: "2270 Camino Vida Roble",
			city: "Carlsbad",
			state: "California",
			zip: "92011",
			ssn: "333333333",
			date_of_birth: "06/15/1983",
		},
	},
	{
		label: "Chris Iceman",
		score: "Frozen",
		data: {
			first_name: "Chris",
			last_name: "Iceman",
			address: "3743 Jefferson St",
			city: "Carlsbad",
			state: "California",
			zip: "92008",
			ssn: "444444444",
			date_of_birth: "09/15/1982",
		},
	},
];

export function PullCreditModal({
	caseId,
	borrowerId,
	open,
	onClose,
	onSuccess,
}: PullCreditModalProps) {
	const [consented, setConsented] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [manualAddressMode, setManualAddressMode] = useState(false);
	const [isTestMode, setIsTestMode] = useState(false);
	const [formData, setFormData] = useState<CreditPullFormData>({
		first_name: "",
		last_name: "",
		address: "",
		city: "",
		state: "",
		zip: "",
		ssn: "",
		date_of_birth: "",
	});

	const { data: appConfig } = useAppConfig();

	// Keep existing local state behavior, but source it from React Query.
	useEffect(() => {
		if (appConfig) {
			setIsTestMode(appConfig.isoftpull_test_mode);
		} else {
			setIsTestMode(false);
		}
	}, [appConfig]);

	useEffect(() => {
		if (open) {
			setConsented(false);
			setError(null);
			setIsLoading(false);
			setManualAddressMode(false);
			// Reset form or pre-fill from case data if available
			setFormData({
				first_name: "",
				last_name: "",
				address: "",
				city: "",
				state: "",
				zip: "",
				ssn: "",
				date_of_birth: "",
			});
		}
	}, [open]);

	const handleAddressSelect = (address: AddressResult) => {
		setFormData((prev) => ({
			...prev,
			address: address.streetAddress,
			city: address.city,
			state: address.state,
			zip: address.postalCode,
		}));
		setError(null);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		if (!nextOpen && !isLoading) {
			onClose();
		}
	};

	const handleInputChange = (field: keyof CreditPullFormData, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		setError(null);
	};

	const handleSubmit = async () => {
		if (PULL_CREDIT_DISABLED) {
			return;
		}

		// Validate caseId
		if (!caseId || caseId === "undefined") {
			setError("Invalid case - please navigate to a valid case first");
			return;
		}

		// Validate required fields
		if (!formData.first_name || !formData.last_name) {
			setError("First name and last name are required");
			return;
		}
		if (!formData.ssn) {
			setError("SSN is required");
			return;
		}

		// Format SSN (remove dashes)
		const ssnClean = formData.ssn.replace(/-/g, "");
		if (ssnClean.length !== 9) {
			setError("SSN must be 9 digits");
			return;
		}

		// Check for test mode - only allow test SSNs when test mode is enabled
		if (isTestMode && !TEST_SSNS.includes(ssnClean)) {
			setError(`Test mode: Use a test SSN or click a test applicant button above`);
			return;
		}

		if (!formData.address || !formData.city || !formData.state || !formData.zip) {
			setError("Full address is required");
			return;
		}

		setIsLoading(true);
		setError(null);

		try {
			const data = await api.post<{ workflow_id: string }>(`/api/v1/case/${caseId}/credit/pull`, {
				borrower_id: borrowerId || "primary",
				first_name: formData.first_name,
				last_name: formData.last_name,
				address: formData.address,
				city: formData.city,
				state: formData.state,
				zip: formData.zip,
				ssn: ssnClean,
				date_of_birth: formData.date_of_birth || undefined,
			});

			onSuccess(data.workflow_id);
			onClose();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Failed to start credit pull";
			setError(message);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-lg bg-[#f5f6f8] border-slate-300 shadow-2xl rounded-2xl p-5 gap-3">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-sm">
						<CreditCard className="h-4 w-4" /> Pull Credit Report
					</DialogTitle>
					<DialogDescription className="text-xs text-[#61728f]">
						Enter borrower information to pull a tri-merge credit report.
					</DialogDescription>
				</DialogHeader>

				{/* Test Mode Quick Fill - Only when ISOFTPULL_TEST_MODE is enabled */}
				{isTestMode && !TEST_MODE_DISABLED && (
					<div className="rounded-md border border-amber-200 bg-amber-50 p-2">
						<div className="text-[10px] font-medium text-amber-700 mb-1.5">
							Test Mode: Quick fill with iSoftPull test applicant
						</div>
						<div className="flex flex-wrap gap-1.5">
							{TEST_APPLICANTS.map((applicant) => (
								<button
									key={applicant.data.ssn}
									type="button"
									onClick={() => {
										setFormData(applicant.data);
										setManualAddressMode(true);
										setError(null);
									}}
									disabled={isLoading}
									className="h-6 px-2 text-[10px] rounded bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 transition-colors disabled:opacity-50"
								>
									{applicant.label} ({applicant.score})
								</button>
							))}
						</div>
					</div>
				)}

				{PULL_CREDIT_DISABLED && (
					<div className="rounded-md border border-slate-300 bg-slate-100 p-3 text-xs text-slate-600">
						Credit pull is temporarily unavailable.
					</div>
				)}

				{/* Form Fields */}
				<div className="space-y-3">
					<div className="grid grid-cols-2 gap-3">
						<div>
							<label className="block text-[10px] font-medium text-slate-600 mb-1">
								First Name *
							</label>
							<input
								type="text"
								value={formData.first_name}
								onChange={(e) => handleInputChange("first_name", e.target.value)}
								className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
								placeholder="Steve"
								disabled={isLoading || PULL_CREDIT_DISABLED}
							/>
						</div>
						<div>
							<label className="block text-[10px] font-medium text-slate-600 mb-1">
								Last Name *
							</label>
							<input
								type="text"
								value={formData.last_name}
								onChange={(e) => handleInputChange("last_name", e.target.value)}
								className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
								placeholder="Johnson"
								disabled={isLoading || PULL_CREDIT_DISABLED}
							/>
						</div>
					</div>

					<div>
						<label className="block text-[10px] font-medium text-slate-600 mb-1">SSN *</label>
						<input
							type="text"
							value={formData.ssn}
							onChange={(e) => handleInputChange("ssn", e.target.value)}
							className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
							placeholder="111111111"
							maxLength={11}
							disabled={isLoading || PULL_CREDIT_DISABLED}
						/>
						{import.meta.env.MODE !== "production" && !TEST_MODE_DISABLED && (
							<p className="text-[9px] text-slate-500 mt-0.5">
								Use a test applicant button above to auto-fill
							</p>
						)}
					</div>

					<div>
						<label className="block text-[10px] font-medium text-slate-600 mb-1">
							Date of Birth
						</label>
						<input
							type="text"
							value={formData.date_of_birth}
							onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
							className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
							placeholder="mm/dd/yyyy"
							disabled={isLoading || PULL_CREDIT_DISABLED}
						/>
					</div>

					{/* Address Autocomplete or Manual Entry */}
					{!manualAddressMode ? (
						<div>
							<div className="flex items-center justify-between mb-1">
								<label className="text-[10px] font-medium text-slate-600">Address *</label>
								<button
									type="button"
									onClick={() => setManualAddressMode(true)}
									className="text-[9px] text-orange-600 hover:text-orange-700 flex items-center gap-0.5"
								>
									<Edit3 className="w-2.5 h-2.5" />
									Enter manually
								</button>
							</div>
							<AddressAutocomplete
								onSelect={handleAddressSelect}
								placeholder="Search address..."
								disabled={isLoading || PULL_CREDIT_DISABLED}
							/>
							{formData.address && (
								<div className="mt-2 text-[10px] text-slate-600 bg-slate-50 rounded-md p-2">
									<div className="font-medium">{formData.address}</div>
									<div>
										{formData.city}, {formData.state} {formData.zip}
									</div>
								</div>
							)}
						</div>
					) : (
						<>
							<div>
								<div className="flex items-center justify-between mb-1">
									<label className="text-[10px] font-medium text-slate-600">Address *</label>
									<button
										type="button"
										onClick={() => setManualAddressMode(false)}
										className="text-[9px] text-orange-600 hover:text-orange-700"
									>
										Use autocomplete
									</button>
								</div>
								<input
									type="text"
									value={formData.address}
									onChange={(e) => handleInputChange("address", e.target.value)}
									className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
									placeholder="123 Main St"
									disabled={isLoading || PULL_CREDIT_DISABLED}
								/>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-[10px] font-medium text-slate-600 mb-1">
										City *
									</label>
									<input
										type="text"
										value={formData.city}
										onChange={(e) => handleInputChange("city", e.target.value)}
										className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
										placeholder="Austin"
										disabled={isLoading || PULL_CREDIT_DISABLED}
									/>
								</div>
								<div>
									<label className="block text-[10px] font-medium text-slate-600 mb-1">
										State *
									</label>
									<input
										type="text"
										value={formData.state}
										onChange={(e) => handleInputChange("state", e.target.value)}
										className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
										placeholder="TX"
										disabled={isLoading || PULL_CREDIT_DISABLED}
									/>
								</div>
								<div>
									<label className="block text-[10px] font-medium text-slate-600 mb-1">ZIP *</label>
									<input
										type="text"
										value={formData.zip}
										onChange={(e) => handleInputChange("zip", e.target.value)}
										className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500"
										placeholder="78701"
										maxLength={10}
										disabled={isLoading || PULL_CREDIT_DISABLED}
									/>
								</div>
							</div>
						</>
					)}
				</div>

				{/* Pricing */}
				<div className="rounded-md border border-slate-300 bg-white/30 p-3 space-y-2">
					<div className="flex items-center justify-between">
						<span className="text-xs text-[#61728f]">Tri-merge credit report</span>
						<span className="text-sm font-semibold font-mono-num">$20.00</span>
					</div>
					<div className="flex items-start gap-2 text-[10px] text-[#61728f]">
						<AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
						<span>The cost will be billed to your account.</span>
					</div>
				</div>

				{/* Consent */}
				<label className="flex items-start gap-3 cursor-pointer rounded-md border border-slate-300 p-3 hover:bg-white/30 transition-colors">
					<span
						className={cn(
							"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
							consented ? "border-[#f55a1f] bg-[#f55a1f]" : "border-[#61728f]",
						)}
					>
						{consented && <span className="block h-1.5 w-1.5 rounded-full bg-white" />}
					</span>
					<input
						type="checkbox"
						className="sr-only"
						checked={consented}
						onChange={(event) => setConsented(event.target.checked)}
						disabled={isLoading || PULL_CREDIT_DISABLED}
					/>
					<span className="text-[10px] text-[#61728f] leading-relaxed">
						I consent, on behalf of the borrower, for Fenero to pull the borrower&apos;s credit.
					</span>
				</label>

				{/* Error */}
				{error && (
					<div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700">
						{error}
					</div>
				)}

				<DialogFooter className="gap-2 sm:gap-0">
					<button
						className="h-8 rounded-md px-3 text-xs font-medium text-slate-700 hover:bg-white/40 transition-colors disabled:opacity-50"
						onClick={() => handleOpenChange(false)}
						disabled={isLoading}
					>
						Cancel
					</button>
					<button
						className="h-8 rounded-md px-3 text-xs font-medium inline-flex items-center gap-1.5 bg-[#f55a1f] text-white hover:bg-[#ea4f15] disabled:bg-[#eda28f] disabled:text-white/95 disabled:cursor-not-allowed transition-colors"
						disabled={!consented || isLoading || PULL_CREDIT_DISABLED}
						onClick={handleSubmit}
					>
						{isLoading ? (
							<>
								<Loader2 className="h-3 w-3 animate-spin" /> Pulling Credit...
							</>
						) : (
							<>
								<DollarSign className="h-3 w-3" /> Pull Credit - $20.00
							</>
						)}
					</button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
