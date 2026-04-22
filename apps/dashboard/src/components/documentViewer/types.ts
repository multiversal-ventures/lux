import type { BoundingBox, Fact } from "../../types";

// =============================================================================
// TYPES FOR BOUNDING BOX EDITING
// =============================================================================

/** Edit mode for bounding boxes */
export type BBoxEditMode = "view" | "edit" | "create";

/** Pending bbox/fact edit that hasn't been saved yet */
export interface PendingFactEdit {
	factIndex: number;
	originalFact: Fact;
	editedFact: Fact;
	bboxChanged: boolean;
	valueChanged: boolean;
}

/** New fact being created with a new bounding box */
export interface NewFactDraft {
	field_name: string;
	value: string;
	bbox: BoundingBox;
	pageNumber: number;
}

/** Drag state for moving/resizing bounding boxes */
export interface DragState {
	active: boolean;
	type:
		| "move"
		| "resize-nw"
		| "resize-ne"
		| "resize-sw"
		| "resize-se"
		| "resize-n"
		| "resize-s"
		| "resize-e"
		| "resize-w";
	startX: number; // Normalized X on starting page (mouse position)
	startY: number; // Normalized Y on starting page (mouse position)
	startClientX: number; // Screen X coordinate
	startClientY: number; // Screen Y coordinate
	startBbox: BoundingBox;
	offsetX: number; // Offset from mouse to bbox corner (normalized)
	offsetY: number; // Offset from mouse to bbox corner (normalized)
	factIndex: number;
	pageNumber: number;
}

/** Active inline edit - the fact being edited directly on the page */
export interface ActiveInlineEdit {
	factIndex: number;
	fact: Fact;
	bbox: BoundingBox;
	pageNumber: number;
	isNew: boolean;
	// Local edit values
	fieldName: string;
	value: string;
}

// =============================================================================
// COMPONENT PROPS INTERFACES
// =============================================================================

/** Props for BoundingBoxOverlay component */
export interface BoundingBoxOverlayProps {
	bbox: BoundingBox;
	isPrimary?: boolean;
	onClick?: () => void;
}

/** Props for EditableBoundingBox component */
export interface EditableBoundingBoxProps {
	bbox: BoundingBox;
	factIndex: number;
	pageNumber: number;
	isPending: boolean;
	isEditing: boolean;
	isDragging: boolean;
	isNew?: boolean;
	isSaving?: boolean;
	onMouseDown: (
		e: React.MouseEvent,
		factIndex: number,
		pageNumber: number,
		type: DragState["type"],
	) => void;
	onClick: () => void;
	onConfirm?: () => void;
}

/** Props for FactCard component */
export interface FactCardProps {
	fact: Fact;
	isSelected: boolean;
	isPending?: boolean;
	isEditing?: boolean;
	isInlineEditing?: boolean;
	editMode?: boolean;
	onClick: () => void;
	onValueChange?: (value: string) => void;
	/** Search query for highlighting matched text */
	searchQuery?: string;
}

/** Props for InlineEditPanel component */
export interface InlineEditPanelProps {
	edit: ActiveInlineEdit;
	containerRef: HTMLDivElement | null;
	onFieldNameChange: (name: string) => void;
	onValueChange: (value: string) => void;
	onSave: () => void;
	onCancel: () => void;
	saving: boolean;
}

/** Props for InteractiveBoundingBox component */
export interface InteractiveBoundingBoxProps {
	bbox: BoundingBox;
	pageNumber: number;
	isNew: boolean;
	isDragging: boolean;
	hasChanges?: boolean;
	isSaving?: boolean;
	onDragStart: (e: React.MouseEvent, type: DragState["type"]) => void;
	onConfirm?: () => void;
	onCancel?: () => void;
}
