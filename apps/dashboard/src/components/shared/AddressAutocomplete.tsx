import { Loader2, MapPin, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";

export interface AddressResult {
	formattedAddress: string;
	streetAddress: string;
	city: string;
	state: string;
	postalCode: string;
}

interface Suggestion {
	place_id: string;
	description: string;
	main_text: string;
	secondary_text: string;
}

interface AddressAutocompleteProps {
	onSelect: (address: AddressResult) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	initialValue?: string;
}

export function AddressAutocomplete({
	onSelect,
	placeholder = "Search address...",
	disabled = false,
	className = "",
	initialValue = "",
}: AddressAutocompleteProps) {
	const [query, setQuery] = useState(initialValue);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [isOpen, setIsOpen] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [activeIndex, setActiveIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Fetch suggestions from backend proxy
	const fetchSuggestions = useCallback(async (input: string) => {
		if (!input || input.length < 3) {
			setSuggestions([]);
			return;
		}

		setIsLoading(true);
		try {
			const data = await api.get<{ suggestions: Suggestion[] }>(
				`/api/v1/places/autocomplete?query=${encodeURIComponent(input)}`,
			);
			setSuggestions(data.suggestions || []);
			setIsOpen(data.suggestions?.length > 0);
		} catch (err) {
			console.error("Failed to fetch suggestions:", err);
			setSuggestions([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Debounced search
	const handleInputChange = (value: string) => {
		setQuery(value);
		setActiveIndex(-1);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			fetchSuggestions(value);
		}, 300);
	};

	// Get place details from backend
	const selectPlace = async (suggestion: Suggestion) => {
		setIsLoading(true);
		setIsOpen(false);
		setQuery(suggestion.description);

		try {
			// API returns snake_case, map to camelCase
			const details = await api.get<{
				formatted_address: string;
				street_address: string;
				city: string;
				state: string;
				postal_code: string;
			}>(`/api/v1/places/details/${suggestion.place_id}`);

			onSelect({
				formattedAddress: details.formatted_address || suggestion.description,
				streetAddress: details.street_address,
				city: details.city,
				state: details.state,
				postalCode: details.postal_code,
			});
		} catch (err) {
			console.error("Failed to get place details:", err);
		} finally {
			setIsLoading(false);
		}
	};

	// Keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!isOpen) return;

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
				break;
			case "ArrowUp":
				e.preventDefault();
				setActiveIndex((prev) => Math.max(prev - 1, 0));
				break;
			case "Enter":
				e.preventDefault();
				if (activeIndex >= 0 && suggestions[activeIndex]) {
					selectPlace(suggestions[activeIndex]);
				}
				break;
			case "Escape":
				setIsOpen(false);
				setActiveIndex(-1);
				break;
		}
	};

	// Click outside to close
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const clearInput = () => {
		setQuery("");
		setSuggestions([]);
		setIsOpen(false);
		inputRef.current?.focus();
	};

	return (
		<div ref={containerRef} className="relative">
			<div className="relative">
				<MapPin className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => handleInputChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => suggestions.length > 0 && setIsOpen(true)}
					placeholder={placeholder}
					disabled={disabled}
					className={`w-full h-8 pl-7 pr-7 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-orange-500 ${className}`}
				/>
				{isLoading ? (
					<Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
				) : query ? (
					<button
						type="button"
						onClick={clearInput}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
					>
						<X className="w-3.5 h-3.5" />
					</button>
				) : null}
			</div>

			{isOpen && suggestions.length > 0 && (
				<div className="absolute z-50 mt-1 w-full bg-white rounded-md border border-slate-200 shadow-lg max-h-60 overflow-auto">
					{suggestions.map((suggestion, index) => (
						<button
							key={suggestion.place_id}
							type="button"
							onClick={() => selectPlace(suggestion)}
							className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 ${
								index === activeIndex ? "bg-slate-100" : ""
							}`}
						>
							<div className="font-medium text-slate-800">{suggestion.main_text}</div>
							<div className="text-slate-500 text-[10px]">{suggestion.secondary_text}</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
