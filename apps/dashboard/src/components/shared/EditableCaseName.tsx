import { useState, useRef, useEffect } from "react";

interface EditableCaseNameProps {
	value: string;
	onSave: (newName: string) => void;
	placeholder?: string;
	className?: string;
	displayClassName?: string;
	inputClassName?: string;
	maxLength?: number;
}

/**
 * Inline editable case name component.
 * Click to edit, save on blur or Enter, cancel on Escape.
 */
export function EditableCaseName({
	value,
	onSave,
	placeholder = "Enter case name...",
	className = "",
	displayClassName = "",
	inputClassName = "",
	maxLength = 100,
}: EditableCaseNameProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState(value);
	const inputRef = useRef<HTMLInputElement>(null);

	// Update edit value when prop value changes (e.g., when case changes)
	useEffect(() => {
		setEditValue(value);
	}, [value]);

	// Focus and select text when entering edit mode
	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	const handleSave = () => {
		const trimmed = editValue.trim();
		// If user cleared the input, revert to original value
		// (This prevents saving empty strings - the parent can handle default generation)
		if (trimmed === "") {
			setEditValue(value);
			setIsEditing(false);
			return;
		}
		// Always save (parent will handle whether it actually changed)
		// This is important when display name is a generated default
		onSave(trimmed);
		setIsEditing(false);
	};

	const handleCancel = () => {
		setEditValue(value); // Reset to original value
		setIsEditing(false);
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			handleSave();
		} else if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			handleCancel();
		}
	};

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (!isEditing) {
			setIsEditing(true);
		}
	};

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="text"
				value={editValue}
				onChange={(e) => setEditValue(e.target.value)}
				onBlur={handleSave}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				maxLength={maxLength}
				className={`${inputClassName} px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white`}
			/>
		);
	}

	return (
		<div className={`flex items-center gap-1.5 group ${className}`}>
			<button
				onClick={handleClick}
				className="flex items-center gap-1.5 hover:opacity-80 transition-opacity cursor-pointer"
				title="Click to edit case name"
			>
				<span className={displayClassName || "text-sm font-medium text-slate-700"}>
					{value || placeholder}
				</span>
				<svg
					className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
					/>
				</svg>
			</button>
		</div>
	);
}
