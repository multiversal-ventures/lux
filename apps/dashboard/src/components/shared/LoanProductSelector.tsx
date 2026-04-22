/**
 * LoanProductSelector - Pills UI for selecting one or more loan products.
 *
 * Fetches available products from the backend, shows loading/error states,
 * and renders all products as pills; disabled products show as "Coming soon".
 * When nothing is selected and optional caseId is provided, fetches income
 * result and auto-selects products present in that result.
 */

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getLoanProducts, type LoanProduct } from "../../hooks/useApi";
import { useIncomeVerification } from "../../hooks/useCaseQueries";
import { Skeleton } from "./Skeleton";

const LOAN_PRODUCTS_QUERY_KEY = ["loan-products"] as const;
const STALE_TIME_MS = 5 * 60 * 1000;

// -----------------------------------------------------------------------------
// Single selection props
// -----------------------------------------------------------------------------

export interface LoanProductSelectorSingleProps {
	isMultiSelection?: false;
	value: string | null;
	onChange: (id: string | null) => void;
	/** When set, income result is used to auto-select product when nothing is selected. */
	caseId?: string | null;
	/** Increment to trigger a 3x blink animation (e.g. when user clicks Start without a selection) */
	blinkTrigger?: number;
	disabled?: boolean;
	className?: string;
	label?: string;
}

// -----------------------------------------------------------------------------
// Multi selection props
// -----------------------------------------------------------------------------

export interface LoanProductSelectorMultiProps {
	isMultiSelection: true;
	value: string[];
	onChange: (ids: string[]) => void;
	/** When set, income result is used to auto-select products when nothing is selected. */
	caseId?: string | null;
	/** Increment to trigger a 3x blink animation (e.g. when user clicks Start without a selection) */
	blinkTrigger?: number;
	disabled?: boolean;
	className?: string;
	label?: string;
}

export type LoanProductSelectorProps =
	| LoanProductSelectorSingleProps
	| LoanProductSelectorMultiProps;

// -----------------------------------------------------------------------------
// Loading state: pill-shaped skeletons
// -----------------------------------------------------------------------------

function LoadingPills() {
	const widths = ["w-28", "w-36", "w-32", "w-40", "w-24"];
	return (
		<div className="flex flex-wrap gap-2" role="status" aria-label="Loading loan products">
			{widths.map((w, i) => (
				<Skeleton key={i} className={`h-8 rounded-full ${w}`} />
			))}
		</div>
	);
}

// -----------------------------------------------------------------------------
// Error state: message + retry
// -----------------------------------------------------------------------------

function ErrorState({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-sm text-slate-600">Could not load loan products.</span>
			<button
				type="button"
				onClick={onRetry}
				className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-full hover:bg-slate-50 transition-colors"
			>
				Try again
			</button>
		</div>
	);
}

// -----------------------------------------------------------------------------
// Pill button for one product
// -----------------------------------------------------------------------------

function ProductPill({
	product,
	selected,
	disabled,
	onToggle,
	blink,
}: {
	product: LoanProduct;
	selected: boolean;
	disabled: boolean;
	onToggle: () => void;
	blink?: boolean;
}) {
	const label = product.display_name || product.id;
	const isComingSoon = !product.enabled;
	const isDisabled = disabled || isComingSoon;
	return (
		<button
			type="button"
			role="button"
			aria-pressed={selected}
			aria-disabled={isDisabled}
			disabled={isDisabled}
			onClick={isComingSoon ? undefined : onToggle}
			title={isComingSoon ? "Coming soon" : undefined}
			className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${blink ? "animate-selector-blink" : ""} ${
				isDisabled
					? "cursor-not-allowed opacity-60 bg-white border-slate-200 text-slate-500"
					: selected
						? "bg-amber-100 border-amber-400 text-amber-800"
						: "cursor-pointer bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50"
			}`}
		>
			{label}
		</button>
	);
}

// -----------------------------------------------------------------------------
// Main component
// -----------------------------------------------------------------------------

export function LoanProductSelector(props: LoanProductSelectorProps) {
	const {
		isMultiSelection = false,
		disabled = false,
		className = "",
		label,
		caseId,
		blinkTrigger = 0,
	} = props;

	const [isBlinking, setIsBlinking] = useState(false);
	const prevBlinkTriggerRef = useRef(blinkTrigger);

	useEffect(() => {
		if (blinkTrigger > prevBlinkTriggerRef.current) {
			prevBlinkTriggerRef.current = blinkTrigger;
			setIsBlinking(true);
		}
	}, [blinkTrigger]);

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: LOAN_PRODUCTS_QUERY_KEY,
		queryFn: getLoanProducts,
		staleTime: STALE_TIME_MS,
	});

	const { data: incomeResponse, isSuccess: incomeSuccess } = useIncomeVerification(
		caseId ?? null,
		undefined,
		{
			enabled: !!caseId,
		},
	);

	const products = data?.products ?? [];
	const hasAutoFilledRef = useRef(false);

	// Auto-fill from income result only once per mount when nothing is selected.
	// Do not refill when user has explicitly deselected all.
	useEffect(() => {
		if (!caseId) return;
		if (hasAutoFilledRef.current) return;
		const isEmpty = isMultiSelection
			? (props.value as string[]).length === 0
			: (props.value as string | null) === null;
		if (!isEmpty) return;
		if (isLoading || !incomeSuccess) return;

		const productsRun = incomeResponse?.products_run ?? [];
		const verifications = incomeResponse?.income_verifications ?? {};
		const primaryId = incomeResponse?.primary_product_id;
		let derivedIds = productsRun.length > 0 ? productsRun : Object.keys(verifications);
		if (derivedIds.length === 0 && primaryId) derivedIds = [primaryId];

		const enabledSet = new Set(products.filter((p) => p.enabled).map((p) => p.id));
		const filtered = derivedIds.filter((id) => enabledSet.has(id));
		if (filtered.length === 0) return;

		hasAutoFilledRef.current = true;
		if (isMultiSelection) {
			(props.onChange as (ids: string[]) => void)(filtered);
		} else {
			(props.onChange as (id: string | null) => void)(filtered[0]);
		}
	}, [
		caseId,
		isMultiSelection,
		isLoading,
		incomeSuccess,
		incomeResponse?.products_run,
		incomeResponse?.income_verifications,
		incomeResponse?.primary_product_id,
		products,
		props.value,
		props.onChange,
	]);

	if (isLoading) {
		return (
			<div className={className} role="group" aria-label={label}>
				{label && <h3 className="block text-base font-semibold text-slate-800 mb-3">{label}</h3>}
				<LoadingPills />
			</div>
		);
	}

	if (isError) {
		return (
			<div className={className} role="group" aria-label={label}>
				{label && <h3 className="block text-base font-semibold text-slate-800 mb-3">{label}</h3>}
				<ErrorState onRetry={() => refetch()} />
			</div>
		);
	}

	if (products.filter((p) => p.enabled).length <= 1) {
		return <div className={className} role="group" aria-label={label}></div>;
	}

	if (isMultiSelection) {
		const { value, onChange } = props;
		const ids = value as string[];
		const selectedSet = new Set(ids);
		const handleToggle = (id: string) => {
			const next = selectedSet.has(id) ? ids.filter((x) => x !== id) : [...ids, id];
			(onChange as (ids: string[]) => void)(next);
		};
		return (
			<div className={className} role="group" aria-label={label}>
				{label && <h3 className="block text-base font-semibold text-slate-800 mb-3">{label}</h3>}
				<div className="flex flex-wrap gap-2" onAnimationEnd={() => setIsBlinking(false)}>
					{products.map((product) => (
						<ProductPill
							key={product.id}
							product={product}
							selected={selectedSet.has(product.id)}
							disabled={disabled}
							onToggle={() => handleToggle(product.id)}
							blink={isBlinking}
						/>
					))}
				</div>
			</div>
		);
	}

	const { value, onChange } = props;
	const selectedId = value as string | null;
	const handleSelect = (id: string) => {
		(onChange as (id: string | null) => void)(selectedId === id ? null : id);
	};
	return (
		<div className={className} role="group" aria-label={label}>
			{label && <h3 className="block text-base font-semibold text-slate-800 mb-3">{label}</h3>}
			<div className="flex flex-wrap gap-2" onAnimationEnd={() => setIsBlinking(false)}>
				{products.map((product) => (
					<ProductPill
						key={product.id}
						product={product}
						selected={selectedId === product.id}
						disabled={disabled}
						onToggle={() => handleSelect(product.id)}
						blink={isBlinking}
					/>
				))}
			</div>
		</div>
	);
}
