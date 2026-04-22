import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { subscribeIdTokenChange } from "../../lib/firebase";
import {
	getPageImageUrl,
	getDocumentClasses,
	patchCase,
	reextractPages,
	type PatchOperation,
	type DocumentClassOption,
} from "../../hooks/useApi";
import type { ExtractedDocument, Fact, BoundingBox, FactSource } from "../../types";
import { getDocClassName, getDocClassInfo, isMISMOStandard } from "../../utils/docUtils";
import { PageImageLoader } from "./PageImageLoader";
import {
	BoundingBoxOverlay,
	EditableBoundingBox,
	FactsList,
	InlineEditPanel,
	InteractiveBoundingBox,
	TableViewModal,
} from "../documentViewer";
import type {
	BBoxEditMode,
	PendingFactEdit,
	NewFactDraft,
	DragState,
	ActiveInlineEdit,
} from "../documentViewer/types";

interface DocumentViewerProps {
	caseId: string;
	document: ExtractedDocument;
	/** Index of this document in extractions.documents array (for JSON Patch paths) */
	docIndex: number;
	/** Focused fact field name from query parameter (for highlighting) */
	focusedFact?: string | null;
	/** Focused page number from URL params (for navigation) */
	focusedPage?: number | null;
	/** Callback when focused fact is cleared */
	onClearFocusedFact?: () => void;
	/** Callback when focused page is cleared */
	onClearFocusedPage?: () => void;
	/** Callback when document is updated */
	onUpdate?: () => void;
	onClose?: () => void;
}

/**
 * DocumentViewer - Displays page images for a classified document.
 *
 * Shows each page as an image with vertical scrolling.
 * Allows editing classification and effective period (full date range).
 * Displays document metadata and facts with bounding boxes.
 */
export function DocumentViewer({
	caseId,
	document,
	docIndex,
	focusedFact,
	focusedPage,
	onClearFocusedFact,
	onClearFocusedPage,
	onUpdate,
}: DocumentViewerProps) {
	const [loadingPages, setLoadingPages] = useState<Set<number>>(new Set());
	const [, setErrorPages] = useState<Set<number>>(new Set());
	// Image timeout cleanup ref
	const imageTimeouts = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
	// Fact refs for scrolling
	const factRefs = useRef<Map<number, HTMLDivElement>>(new Map());
	const [showEditPanel, setShowEditPanel] = useState(false);
	const [documentClasses, setDocumentClasses] = useState<DocumentClassOption[]>([]);
	const [saving, setSaving] = useState(false);
	const [authToken, setAuthToken] = useState<string | undefined>(undefined);
	const [authReady, setAuthReady] = useState(false);

	// Fetch auth token for secure image loading
	// Wait for auth to be ready before rendering page images to avoid 401 errors
	useEffect(() => {
		const unsubscribe = subscribeIdTokenChange(async (user) => {
			if (user) {
				const token = await user.getIdToken();
				setAuthToken(token);
			} else {
				setAuthToken(undefined);
			}
			setAuthReady(true); // Mark auth as ready (even if no token - allows anonymous access if supported)
		});
		return () => unsubscribe();
	}, []);

	// Selected fact for highlighting - stores all sources to highlight
	const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
	const [highlightedSources, setHighlightedSources] = useState<FactSource[]>([]);
	// Track which page to highlight when a fact is selected (even without bbox)
	const [highlightedPageNumber, setHighlightedPageNumber] = useState<number | null>(null);
	const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

	// Edit state - full period support
	const [editClass, setEditClass] = useState(document.document_type);
	const [editDescription, setEditDescription] = useState(document.description ?? "");
	const [editPeriodStart, setEditPeriodStart] = useState(
		document.effective_period?.period_start ?? "",
	);
	const [editPeriodEnd, setEditPeriodEnd] = useState(document.effective_period?.period_end ?? "");

	// Bounding box editing state
	const [bboxEditMode, setBboxEditMode] = useState<BBoxEditMode>("view");
	const [pendingFactEdits, setPendingFactEdits] = useState<Map<number, PendingFactEdit>>(new Map());
	const [newFactDraft, setNewFactDraft] = useState<NewFactDraft | null>(null);
	const [dragState, setDragState] = useState<DragState | null>(null);
	const [editingFactIndex, setEditingFactIndex] = useState<number | null>(null);
	const [savingFactEdits, setSavingFactEdits] = useState(false);
	const [savingSingleFactIndex, setSavingSingleFactIndex] = useState<number | null>(null);

	// Active inline edit - shown directly on the page next to the bbox
	const [activeInlineEdit, setActiveInlineEdit] = useState<ActiveInlineEdit | null>(null);

	// Re-extract state (prefixed with _ as currently unused but kept for future use)
	const [_reextractingPage, setReextractingPage] = useState<number | null>(null);
	const [_showReextractConfirm, setShowReextractConfirm] = useState<number | null>(null);

	// Table view modal state
	const [showTableModal, setShowTableModal] = useState(false);

	// Drag state for inline edit mode (separate from edit mode drag)
	const [inlineDragState, setInlineDragState] = useState<{
		active: boolean;
		type: DragState["type"];
		startX: number; // Normalized X on starting page (mouse position)
		startY: number; // Normalized Y on starting page (mouse position)
		startClientX: number; // Screen X coordinate
		startClientY: number; // Screen Y coordinate
		startBbox: BoundingBox;
		offsetX: number; // Offset from mouse to bbox corner (normalized)
		offsetY: number; // Offset from mouse to bbox corner (normalized)
		pageNumber: number;
	} | null>(null);

	// Track page container dimensions for coordinate conversion
	const pageContainerRefs = useRef<
		Map<number, { el: HTMLDivElement; width: number; height: number }>
	>(new Map());

	// Check if this is a custom (non-MISMO) document type
	const isCustomType = !isMISMOStandard(document.document_type);

	// Sort pages by page number
	const sortedPages = [...document.pages].sort((a, b) => a.page_number - b.page_number);

	// Sort facts by confidence (descending - highest first) then by field name
	const sortedFacts = useMemo(() => {
		if (!document.facts || document.facts.length === 0) return [];

		// Create array with original indices for proper ref mapping
		const factsWithIndices = document.facts.map((fact, idx) => ({ fact, originalIndex: idx }));

		return factsWithIndices.sort((a, b) => {
			// Primary sort: confidence descending (higher confidence = top)
			const confA = a.fact.confidence ?? 1.0;
			const confB = b.fact.confidence ?? 1.0;
			if (confA !== confB) return confB - confA;

			// Secondary sort: field name alphabetically
			return (a.fact.field_name || "").localeCompare(b.fact.field_name || "");
		});
	}, [document.facts]);

	// Get preload URLs for adjacent pages (for image caching optimization)
	const getPreloadUrls = useCallback(
		(currentPageNumber: number): string[] => {
			const currentIndex = sortedPages.findIndex((p) => p.page_number === currentPageNumber);
			if (currentIndex === -1) return [];

			const urls: string[] = [];
			// Preload next page
			if (currentIndex + 1 < sortedPages.length) {
				const nextPage = sortedPages[currentIndex + 1];
				urls.push(getPageImageUrl(caseId, nextPage.file_id, nextPage.page_number, authToken));
			}
			// Preload previous page
			if (currentIndex - 1 >= 0) {
				const prevPage = sortedPages[currentIndex - 1];
				urls.push(getPageImageUrl(caseId, prevPage.file_id, prevPage.page_number, authToken));
			}
			return urls;
		},
		[caseId, sortedPages, authToken],
	);

	// Check if period is undetermined - only check period_start/period_end (not tax_year)
	const isPeriodUndetermined =
		document.period_status === "undetermined" ||
		(!document.effective_period?.period_start && !document.effective_period?.period_end);

	// Check if agent is still actively processing this document
	const isAgentStillProcessing =
		(document.processing_status && document.processing_status !== "complete") ||
		document.validation_status === "validating" ||
		document.validation_status === "re_extracting";

	// Load document classes for dropdown
	useEffect(() => {
		getDocumentClasses()
			.then((res) => setDocumentClasses(res.document_classes))
			.catch(() => {});
	}, []);

	// Stable document identity - only changes when a DIFFERENT document is selected
	// SSE updates to the same document don't change this key
	const documentIdentityKey = `${document.file_id}:${document.document_type}:${sortedPages[0]?.page_number ?? 0}`;

	// Reset edit state only when a DIFFERENT document is selected (not on SSE updates)
	// This preserves local editing state while the document content updates from SSE
	useEffect(() => {
		setEditClass(document.document_type);
		setEditDescription(document.description ?? "");
		setEditPeriodStart(document.effective_period?.period_start ?? "");
		setEditPeriodEnd(document.effective_period?.period_end ?? "");
		setSelectedFact(null);
		setHighlightedSources([]);
		setHighlightedPageNumber(null);
		// Reset bbox editing state
		setBboxEditMode("view");
		setPendingFactEdits(new Map());
		setNewFactDraft(null);
		setDragState(null);
		setEditingFactIndex(null);
		setActiveInlineEdit(null);
	}, [documentIdentityKey]); // Only reset when document identity changes, not on content updates

	// Exit edit mode when a new fact is focused (e.g., from Income tab navigation)
	// This allows clicking fact links to work even when in edit mode
	useEffect(() => {
		if (focusedFact && bboxEditMode !== "view") {
			// Cancel any pending edits and exit edit mode
			cancelBboxEdits();
		}
	}, [focusedFact]); // eslint-disable-line react-hooks/exhaustive-deps

	// =============================================================================
	// BOUNDING BOX EDITING FUNCTIONS
	// =============================================================================

	/** Get the edited bbox for a fact, or the original if not edited.
	 *  Returns bbox with page_number included. Uses sources array when available. */
	const getEffectiveBbox = useCallback(
		(factIndex: number): (BoundingBox & { page_number: number }) | undefined => {
			const pendingEdit = pendingFactEdits.get(factIndex);
			const fact = document.facts?.[factIndex];
			if (!fact) return undefined;

			// Get the base bbox (pending edit or original)
			let bbox: BoundingBox | undefined;
			let pageNumber: number | undefined;

			if (pendingEdit?.editedFact.bbox) {
				bbox = pendingEdit.editedFact.bbox;
				pageNumber = bbox.page_number;
			}

			// If no pending edit bbox or no page_number, get from sources or original
			if (!bbox || pageNumber === undefined) {
				if (fact.sources && fact.sources.length > 0 && fact.sources[0].bbox) {
					bbox = bbox ?? fact.sources[0].bbox;
					pageNumber = pageNumber ?? fact.sources[0].page_number;
				} else if (fact.bbox) {
					bbox = bbox ?? fact.bbox;
					pageNumber = pageNumber ?? fact.bbox.page_number;
				}
			}

			if (!bbox || pageNumber === undefined) return undefined;

			return { ...bbox, page_number: pageNumber };
		},
		[pendingFactEdits, document.facts],
	);

	/** Start a bbox edit for an existing fact */
	const startBboxEdit = useCallback(
		(factIndex: number, fact: Fact) => {
			if (!pendingFactEdits.has(factIndex)) {
				setPendingFactEdits((prev) => {
					const next = new Map(prev);
					next.set(factIndex, {
						factIndex,
						originalFact: fact,
						editedFact: { ...fact },
						bboxChanged: false,
						valueChanged: false,
					});
					return next;
				});
			}
			setEditingFactIndex(factIndex);
		},
		[pendingFactEdits],
	);

	/** Update bbox for a pending edit */
	const updatePendingBbox = useCallback((factIndex: number, newBbox: BoundingBox) => {
		setPendingFactEdits((prev) => {
			const next = new Map(prev);
			const edit = next.get(factIndex);
			if (edit) {
				const original = edit.originalFact.bbox;
				const bboxChanged =
					!original ||
					newBbox.x1 !== original.x1 ||
					newBbox.y1 !== original.y1 ||
					newBbox.x2 !== original.x2 ||
					newBbox.y2 !== original.y2;
				next.set(factIndex, {
					...edit,
					editedFact: { ...edit.editedFact, bbox: newBbox },
					bboxChanged,
				});
			}
			return next;
		});
	}, []);

	/** Update fact value for a pending edit */
	const updatePendingValue = useCallback(
		(factIndex: number, newValue: string | number | boolean) => {
			setPendingFactEdits((prev) => {
				const next = new Map(prev);
				const edit = next.get(factIndex);
				if (edit) {
					const valueChanged = String(newValue) !== String(edit.originalFact.value);
					next.set(factIndex, {
						...edit,
						editedFact: { ...edit.editedFact, value: newValue },
						valueChanged,
					});
				}
				return next;
			});
		},
		[],
	);

	/** Start inline edit for a fact - opens the floating panel right on the bbox */
	const startInlineEdit = useCallback(
		(factIndex: number, fact: Fact) => {
			// Get bbox and page number from sources (preferred) or legacy bbox
			let bbox: BoundingBox | undefined;
			let pageNumber: number;

			if (fact.sources && fact.sources.length > 0 && fact.sources[0].bbox) {
				// Use first source's bbox and page number
				bbox = fact.sources[0].bbox;
				pageNumber = fact.sources[0].page_number;
			} else if (fact.bbox) {
				// Legacy: use fact.bbox with fallback page number
				bbox = fact.bbox;
				pageNumber = fact.bbox.page_number ?? sortedPages[0]?.page_number ?? 1;
			} else {
				// No bbox available
				return;
			}

			setActiveInlineEdit({
				factIndex,
				fact,
				bbox: { ...bbox },
				pageNumber,
				isNew: false,
				fieldName: fact.field_name,
				value: String(fact.value),
			});

			// Also set up pending edit tracking
			if (!pendingFactEdits.has(factIndex)) {
				setPendingFactEdits((prev) => {
					const next = new Map(prev);
					next.set(factIndex, {
						factIndex,
						originalFact: fact,
						editedFact: { ...fact },
						bboxChanged: false,
						valueChanged: false,
					});
					return next;
				});
			}

			setEditingFactIndex(factIndex);
			setHighlightedPageNumber(pageNumber);

			// Scroll to the page - use 'start' to scroll to top of page
			const pageEl = pageRefs.current.get(pageNumber);
			if (pageEl) {
				pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		},
		[sortedPages, pendingFactEdits],
	);

	/** Update the active inline edit's bbox */
	const updateInlineEditBbox = useCallback((newBbox: BoundingBox) => {
		setActiveInlineEdit((prev) => (prev ? { ...prev, bbox: newBbox } : null));
	}, []);

	/** Update inline edit field name */
	const updateInlineEditFieldName = useCallback((fieldName: string) => {
		setActiveInlineEdit((prev) => (prev ? { ...prev, fieldName } : null));
	}, []);

	/** Update inline edit value */
	const updateInlineEditValue = useCallback((value: string) => {
		setActiveInlineEdit((prev) => (prev ? { ...prev, value } : null));
	}, []);

	/** Convert mouse event to normalized coordinates (0-1) */
	const eventToNormalizedCoords = useCallback(
		(e: React.MouseEvent, pageNumber: number): { x: number; y: number } | null => {
			const container = pageContainerRefs.current.get(pageNumber);
			if (!container) return null;

			const rect = container.el.getBoundingClientRect();
			const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
			const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
			return { x, y };
		},
		[],
	);

	/** Find which page number contains the given mouse coordinates */
	const findPageUnderMouse = useCallback((clientX: number, clientY: number): number | null => {
		for (const [pageNumber, container] of pageContainerRefs.current) {
			const rect = container.el.getBoundingClientRect();
			if (
				clientX >= rect.left &&
				clientX <= rect.right &&
				clientY >= rect.top &&
				clientY <= rect.bottom
			) {
				return pageNumber;
			}
		}
		return null;
	}, []);

	/** Start drag for inline edit bbox */
	const handleInlineDragStart = useCallback(
		(e: React.MouseEvent, pageNumber: number, type: DragState["type"]) => {
			if (!activeInlineEdit) return;

			const coords = eventToNormalizedCoords(e, pageNumber);
			if (!coords) return;

			// Calculate offset from mouse position to bbox corner
			// This offset will be maintained as we drag across pages
			const offsetX = activeInlineEdit.bbox.x1 - coords.x;
			const offsetY = activeInlineEdit.bbox.y1 - coords.y;

			setInlineDragState({
				active: true,
				type,
				startX: coords.x,
				startY: coords.y,
				startClientX: e.clientX,
				startClientY: e.clientY,
				startBbox: { ...activeInlineEdit.bbox },
				offsetX,
				offsetY,
				pageNumber,
			});
		},
		[activeInlineEdit, eventToNormalizedCoords],
	);

	/** Save the current inline edit using RFC 6902 JSON Patch */
	const saveInlineEdit = useCallback(async () => {
		if (!activeInlineEdit || savingFactEdits) {
			return;
		}

		setSavingFactEdits(true);
		try {
			const { factIndex, bbox, fieldName, value, isNew } = activeInlineEdit;
			const originalFact = factIndex >= 0 ? document.facts?.[factIndex] : null;

			// Determine if value changed
			const valueChanged = isNew || (originalFact && String(value) !== String(originalFact.value));

			// Build RFC 6902 patch operations
			// The component knows what it's editing - build the patch directly
			const patch: PatchOperation[] = [];
			const now = new Date().toISOString();
			const basePath = `/extractions/documents/${docIndex}/facts/${factIndex}`;

			if (isNew) {
				// Adding a new fact
				patch.push({
					op: "add",
					path: `/extractions/documents/${docIndex}/facts/-`,
					value: {
						field_name: fieldName,
						value: value,
						bbox: {
							x1: bbox.x1,
							y1: bbox.y1,
							x2: bbox.x2,
							y2: bbox.y2,
							page_number: bbox.page_number,
						},
						edited_by: "user",
						edited_at: now,
						confidence: 1.0,
					},
				});
			} else {
				// Updating existing fact
				// Update bbox
				const hasBbox = originalFact?.bbox != null;
				patch.push({
					op: hasBbox ? "replace" : "add",
					path: `${basePath}/bbox`,
					value: {
						x1: bbox.x1,
						y1: bbox.y1,
						x2: bbox.x2,
						y2: bbox.y2,
						page_number: bbox.page_number,
					},
				});

				// Update value if changed
				if (valueChanged) {
					patch.push({
						op: "replace",
						path: `${basePath}/value`,
						value: value,
					});
				}

				// Add edit metadata
				patch.push(
					{ op: "add", path: `${basePath}/edited_by`, value: "user" },
					{ op: "add", path: `${basePath}/edited_at`, value: now },
					{ op: "add", path: `${basePath}/confidence`, value: 1.0 },
				);
			}

			await patchCase(caseId, {
				patch,
				description: valueChanged
					? `Updated fact "${fieldName}" with new value`
					: `Updated bounding box for "${fieldName}"`,
			});

			// Clear state immediately before triggering refresh
			setActiveInlineEdit(null);
			setPendingFactEdits(new Map());
			setEditingFactIndex(null);
			setHighlightedSources([]);
			setHighlightedPageNumber(null);
			setSelectedFact(null);

			// Trigger parent refresh
			onUpdate?.();
		} catch (err) {
			console.error("Failed to save inline edit:", err);
			alert("Failed to save changes: " + (err instanceof Error ? err.message : "Unknown error"));
		} finally {
			setSavingFactEdits(false);
		}
	}, [activeInlineEdit, savingFactEdits, document.facts, docIndex, caseId, onUpdate]);

	/** Cancel the current inline edit */
	const cancelInlineEdit = useCallback(() => {
		setActiveInlineEdit(null);
		setPendingFactEdits(new Map());
		setEditingFactIndex(null);
	}, []);

	/** Cancel all pending edits */
	const cancelBboxEdits = useCallback(() => {
		setPendingFactEdits(new Map());
		setActiveInlineEdit(null);
		setNewFactDraft(null);
		setEditingFactIndex(null);
		setBboxEditMode("view");
	}, []);

	/** Re-extract a page (discards manual edits) - kept for future use */
	const _handleReextractPage = useCallback(
		async (page: { file_id: string; page_number: number }) => {
			setReextractingPage(page.page_number);
			setShowReextractConfirm(null);
			try {
				await reextractPages(caseId, {
					source_refs: [
						{
							file_id: page.file_id,
							page_number: page.page_number,
							document_class: document.document_type,
						},
					],
				});
				// Trigger refresh after a short delay to allow workflow to start
				setTimeout(() => {
					onUpdate?.();
					setReextractingPage(null);
				}, 2000);
			} catch (err) {
				console.error("Re-extract failed:", err);
				setReextractingPage(null);
			}
		},
		[caseId, document.document_type, onUpdate],
	);

	/** Handle mouse down on a bounding box (start drag) */
	const handleBboxMouseDown = useCallback(
		(e: React.MouseEvent, factIndex: number, pageNumber: number, type: DragState["type"]) => {
			e.preventDefault();
			e.stopPropagation();

			const coords = eventToNormalizedCoords(e, pageNumber);
			if (!coords) return;

			const fact = document.facts?.[factIndex];
			if (!fact?.bbox) return;

			// Ensure we have a pending edit started
			if (!pendingFactEdits.has(factIndex)) {
				startBboxEdit(factIndex, fact);
			}

			const currentBbox = getEffectiveBbox(factIndex) || fact.bbox;

			// Calculate offset from mouse position to bbox corner
			// This offset will be maintained as we drag across pages
			const offsetX = currentBbox.x1 - coords.x;
			const offsetY = currentBbox.y1 - coords.y;

			setDragState({
				active: true,
				type,
				startX: coords.x,
				startY: coords.y,
				startClientX: e.clientX,
				startClientY: e.clientY,
				startBbox: { ...currentBbox },
				offsetX,
				offsetY,
				factIndex,
				pageNumber,
			});
		},
		[document.facts, pendingFactEdits, getEffectiveBbox, startBboxEdit, eventToNormalizedCoords],
	);

	/** Document-level mouse move handler for cross-page dragging */
	const handleDocumentMouseMove = useCallback(
		(e: MouseEvent) => {
			if (!dragState?.active && !inlineDragState?.active) return;

			// Find which page the mouse is currently over
			const currentPageNumber = findPageUnderMouse(e.clientX, e.clientY);
			if (!currentPageNumber) return;

			// Get page container for coordinate conversion
			const container = pageContainerRefs.current.get(currentPageNumber);
			if (!container) return;

			const rect = container.el.getBoundingClientRect();

			// Handle edit mode drag
			if (dragState?.active) {
				const { startBbox, factIndex, type, offsetX, offsetY } = dragState;

				// Get current mouse position in normalized coordinates on current page
				const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
				const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

				// Update drag state if page changed
				if (currentPageNumber !== dragState.pageNumber) {
					// When crossing pages, update the page number in drag state
					setDragState((prev) => (prev ? { ...prev, pageNumber: currentPageNumber } : null));
				}

				let newBbox: BoundingBox;

				if (type === "move") {
					// Move: position bbox at current mouse position + offset
					// This makes the bbox follow the mouse cursor across pages
					const width = startBbox.x2 - startBbox.x1;
					const height = startBbox.y2 - startBbox.y1;
					let newX1 = currentX + offsetX;
					let newY1 = currentY + offsetY;
					// Clamp to bounds
					newX1 = Math.max(0, Math.min(1 - width, newX1));
					newY1 = Math.max(0, Math.min(1 - height, newY1));
					newBbox = {
						x1: newX1,
						y1: newY1,
						x2: newX1 + width,
						y2: newY1 + height,
						page_number: currentPageNumber,
					};
				} else {
					// Resize: calculate delta from initial mouse position
					const screenDeltaX = e.clientX - dragState.startClientX;
					const screenDeltaY = e.clientY - dragState.startClientY;
					const dx = screenDeltaX / rect.width;
					const dy = screenDeltaY / rect.height;

					newBbox = { ...startBbox, page_number: currentPageNumber };
					const minSize = 0.02; // Minimum 2% of page

					if (type.includes("n")) {
						newBbox.y1 = Math.max(0, Math.min(startBbox.y2 - minSize, startBbox.y1 + dy));
					}
					if (type.includes("s")) {
						newBbox.y2 = Math.max(startBbox.y1 + minSize, Math.min(1, startBbox.y2 + dy));
					}
					if (type.includes("w")) {
						newBbox.x1 = Math.max(0, Math.min(startBbox.x2 - minSize, startBbox.x1 + dx));
					}
					if (type.includes("e")) {
						newBbox.x2 = Math.max(startBbox.x1 + minSize, Math.min(1, startBbox.x2 + dx));
					}
				}

				updatePendingBbox(factIndex, newBbox);
			}

			// Handle inline edit drag
			if (inlineDragState?.active && activeInlineEdit) {
				const { startBbox, type, offsetX, offsetY } = inlineDragState;

				// Get current mouse position in normalized coordinates on current page
				const currentX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
				const currentY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

				// Update inline drag state if page changed
				if (currentPageNumber !== inlineDragState.pageNumber) {
					// When crossing pages, update the page number in both states
					setInlineDragState((prev) => (prev ? { ...prev, pageNumber: currentPageNumber } : null));
					// Update active inline edit page number to reflect new page
					setActiveInlineEdit((prev) => (prev ? { ...prev, pageNumber: currentPageNumber } : null));
				}

				let newBbox: BoundingBox;

				if (type === "move") {
					// Move: position bbox at current mouse position + offset
					// This makes the bbox follow the mouse cursor across pages
					const width = startBbox.x2 - startBbox.x1;
					const height = startBbox.y2 - startBbox.y1;
					let newX1 = currentX + offsetX;
					let newY1 = currentY + offsetY;
					newX1 = Math.max(0, Math.min(1 - width, newX1));
					newY1 = Math.max(0, Math.min(1 - height, newY1));
					newBbox = {
						x1: newX1,
						y1: newY1,
						x2: newX1 + width,
						y2: newY1 + height,
						page_number: currentPageNumber,
					};
				} else {
					// Resize: calculate delta from initial mouse position
					const screenDeltaX = e.clientX - inlineDragState.startClientX;
					const screenDeltaY = e.clientY - inlineDragState.startClientY;
					const dx = screenDeltaX / rect.width;
					const dy = screenDeltaY / rect.height;

					newBbox = { ...startBbox, page_number: currentPageNumber };
					const minSize = 0.02;

					if (type.includes("n")) {
						newBbox.y1 = Math.max(0, Math.min(startBbox.y2 - minSize, startBbox.y1 + dy));
					}
					if (type.includes("s")) {
						newBbox.y2 = Math.max(startBbox.y1 + minSize, Math.min(1, startBbox.y2 + dy));
					}
					if (type.includes("w")) {
						newBbox.x1 = Math.max(0, Math.min(startBbox.x2 - minSize, startBbox.x1 + dx));
					}
					if (type.includes("e")) {
						newBbox.x2 = Math.max(startBbox.x1 + minSize, Math.min(1, startBbox.x2 + dx));
					}
				}

				updateInlineEditBbox(newBbox);
			}
		},
		[
			dragState,
			inlineDragState,
			activeInlineEdit,
			findPageUnderMouse,
			updatePendingBbox,
			updateInlineEditBbox,
		],
	);

	/** Document-level mouse up handler for cross-page dragging */
	const handleDocumentMouseUp = useCallback(() => {
		if (dragState?.active) {
			setDragState(null);
		}
		if (inlineDragState?.active) {
			setInlineDragState(null);
		}
	}, [dragState, inlineDragState]);

	/** Handle click on page to create new bbox (when in create mode) */
	const handlePageClick = useCallback(
		(e: React.MouseEvent, pageNumber: number) => {
			if (bboxEditMode !== "create") return;

			const coords = eventToNormalizedCoords(e, pageNumber);
			if (!coords) return;

			// Create a small default bbox at click position
			const size = 0.1; // 10% of page
			const halfSize = size / 2;

			const newBbox: BoundingBox = {
				x1: Math.max(0, coords.x - halfSize),
				y1: Math.max(0, coords.y - halfSize),
				x2: Math.min(1, coords.x + halfSize),
				y2: Math.min(1, coords.y + halfSize),
				page_number: pageNumber,
			};

			// Create inline edit directly (not separate draft state)
			setActiveInlineEdit({
				factIndex: -1, // -1 indicates new fact
				fact: {
					field_name: "",
					value: "",
					bbox: newBbox,
					provenance: {
						type: "custom",
						source: "manual",
						element: "",
						version: "",
					},
				},
				bbox: newBbox,
				pageNumber,
				isNew: true,
				fieldName: "",
				value: "",
			});

			setBboxEditMode("view"); // Exit create mode once bbox is placed
		},
		[bboxEditMode, eventToNormalizedCoords],
	);

	/** Save all pending bbox/fact edits using RFC 6902 JSON Patch */
	const savePendingEdits = async () => {
		if (savingFactEdits || (pendingFactEdits.size === 0 && !newFactDraft)) return;

		setSavingFactEdits(true);
		try {
			// Determine if we need to trigger revalidation
			// Only trigger if any fact VALUE changed (not just bbox position)
			const anyValueChanged =
				Array.from(pendingFactEdits.values()).some((e) => e.valueChanged) ||
				(newFactDraft && newFactDraft.value.trim() !== "");

			const patch: PatchOperation[] = [];
			const now = new Date().toISOString();

			// Build patches for existing fact edits
			for (const [factIndex, edit] of pendingFactEdits) {
				const basePath = `/extractions/documents/${docIndex}/facts/${factIndex}`;
				const hasBbox = edit.originalFact.bbox != null;

				// Update bbox
				if (edit.bboxChanged && edit.editedFact.bbox) {
					patch.push({
						op: hasBbox ? "replace" : "add",
						path: `${basePath}/bbox`,
						value: {
							x1: edit.editedFact.bbox.x1,
							y1: edit.editedFact.bbox.y1,
							x2: edit.editedFact.bbox.x2,
							y2: edit.editedFact.bbox.y2,
							page_number: edit.editedFact.bbox.page_number,
						},
					});
				}

				// Update value if changed
				if (edit.valueChanged) {
					patch.push({
						op: "replace",
						path: `${basePath}/value`,
						value: edit.editedFact.value,
					});
				}

				// Add edit metadata
				patch.push(
					{ op: "add", path: `${basePath}/edited_by`, value: "user" },
					{ op: "add", path: `${basePath}/edited_at`, value: now },
					{ op: "add", path: `${basePath}/confidence`, value: 1.0 },
				);
			}

			// Add new fact if exists
			if (newFactDraft && newFactDraft.field_name.trim() && newFactDraft.value.trim()) {
				patch.push({
					op: "add",
					path: `/extractions/documents/${docIndex}/facts/-`,
					value: {
						field_name: newFactDraft.field_name,
						value: newFactDraft.value,
						bbox: {
							x1: newFactDraft.bbox.x1,
							y1: newFactDraft.bbox.y1,
							x2: newFactDraft.bbox.x2,
							y2: newFactDraft.bbox.y2,
							page_number: newFactDraft.bbox.page_number,
						},
						edited_by: "user",
						edited_at: now,
						confidence: 1.0,
					},
				});
			}

			if (patch.length > 0) {
				await patchCase(caseId, {
					patch,
					description: anyValueChanged
						? "Updated facts with bounding boxes"
						: "Updated bounding box positions only",
				});
				onUpdate?.();
			}

			// Clear editing state
			cancelBboxEdits();
		} catch (err) {
			console.error("Failed to save fact edits:", err);
			alert("Failed to save changes");
		} finally {
			setSavingFactEdits(false);
		}
	};

	/** Save a single bbox edit (for quick confirm button) */
	const confirmSingleBboxEdit = async (factIndex: number) => {
		const edit = pendingFactEdits.get(factIndex);
		if (!edit || savingSingleFactIndex !== null) return;

		setSavingSingleFactIndex(factIndex);
		try {
			const patch: PatchOperation[] = [];
			const now = new Date().toISOString();
			const basePath = `/extractions/documents/${docIndex}/facts/${factIndex}`;
			const hasBbox = edit.originalFact.bbox != null;

			// Update bbox
			if (edit.bboxChanged && edit.editedFact.bbox) {
				patch.push({
					op: hasBbox ? "replace" : "add",
					path: `${basePath}/bbox`,
					value: {
						x1: edit.editedFact.bbox.x1,
						y1: edit.editedFact.bbox.y1,
						x2: edit.editedFact.bbox.x2,
						y2: edit.editedFact.bbox.y2,
						page_number: edit.editedFact.bbox.page_number,
					},
				});
			}

			// Update value if changed
			if (edit.valueChanged) {
				patch.push({
					op: "replace",
					path: `${basePath}/value`,
					value: edit.editedFact.value,
				});
			}

			// Add edit metadata
			patch.push(
				{ op: "add", path: `${basePath}/edited_by`, value: "user" },
				{ op: "add", path: `${basePath}/edited_at`, value: now },
				{ op: "add", path: `${basePath}/confidence`, value: 1.0 },
			);

			if (patch.length > 0) {
				await patchCase(caseId, {
					patch,
					description: edit.valueChanged
						? `Updated fact ${factIndex} with bounding box`
						: `Updated bounding box for fact ${factIndex}`,
				});
				onUpdate?.();
			}

			// Remove this fact from pending edits
			setPendingFactEdits((prev) => {
				const next = new Map(prev);
				next.delete(factIndex);
				return next;
			});

			// Clear editing state if this was the one being edited
			if (editingFactIndex === factIndex) {
				setEditingFactIndex(null);
			}
		} catch (err) {
			console.error("Failed to save bbox edit:", err);
			alert("Failed to save bbox change");
		} finally {
			setSavingSingleFactIndex(null);
		}
	};

	const handleImageLoad = (pageNum: number) => {
		setLoadingPages((prev) => {
			const next = new Set(prev);
			next.delete(pageNum);
			return next;
		});
	};

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			imageTimeouts.current.forEach((timeout) => clearTimeout(timeout));
			imageTimeouts.current.clear();
		};
	}, []);

	// Initialize loading state for all pages - only when pages actually change
	// Use a stable key based on file_id and page numbers to avoid resetting on fact updates
	const pagesKey = sortedPages.map((p) => `${p.file_id}:${p.page_number}`).join(",");
	useEffect(() => {
		setLoadingPages(new Set(sortedPages.map((p) => p.page_number)));
		setErrorPages(new Set());
	}, [pagesKey]); // Only reset when pages identity changes, not when facts change

	// Scroll to page when fact is selected - scroll to top of page, not center
	const scrollToPage = (pageNumber: number) => {
		const pageEl = pageRefs.current.get(pageNumber);
		if (pageEl) {
			pageEl.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	};

	// Handle fact click - if fact has bbox, start inline edit; otherwise just highlight page
	const handleFactClick = (fact: Fact, factIndex: number, scrollToFact = false) => {
		setSelectedFact(fact);

		// Build sources array from fact
		const sources: FactSource[] = [];
		let targetPage = sortedPages[0]?.page_number ?? 1;

		// Check for multiple sources first
		if (fact.sources && fact.sources.length > 0) {
			sources.push(...fact.sources);
			targetPage = fact.sources[0].page_number;
		}
		// Fall back to single bbox (legacy)
		else if (fact.bbox) {
			// Try to get page number from bbox, fall back to first page of document
			const pageNum = fact.bbox.page_number ?? sortedPages[0]?.page_number ?? 1;
			targetPage = pageNum;
			sources.push({
				page_number: pageNum,
				bbox: fact.bbox,
				source_text: fact.source_text,
			});
		}

		setHighlightedSources(sources);
		setHighlightedPageNumber(targetPage);

		// Scroll to fact card if requested
		if (scrollToFact) {
			setTimeout(() => {
				const factEl = factRefs.current.get(factIndex);
				if (factEl) {
					factEl.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			}, 100);
		}

		// If fact has a bbox, start inline edit mode for direct editing
		if (fact.bbox) {
			startInlineEdit(factIndex, fact);
		} else {
			// No bbox - just scroll to page
			scrollToPage(targetPage);
		}
	};

	// Handle focusedFact from query parameter
	useEffect(() => {
		if (focusedFact && document.facts) {
			const factIndex = document.facts.findIndex((f) => f.field_name === focusedFact);
			if (factIndex >= 0) {
				// Small delay to ensure rendering is complete
				setTimeout(() => {
					handleFactClick(document.facts[factIndex], factIndex, true);
					// Clear focused fact after processing
					onClearFocusedFact?.();
				}, 200);
			}
		}
	}, [focusedFact, document.facts]);

	// Handle focusedPage from URL query parameter - scroll to specific page
	useEffect(() => {
		if (focusedPage && document.pages) {
			// Verify the page exists in this document
			const pageExists = document.pages.some((p) => p.page_number === focusedPage);
			if (pageExists) {
				// Small delay to ensure page images are rendered
				setTimeout(() => {
					scrollToPage(focusedPage);
					// Clear focused page after processing
					onClearFocusedPage?.();
				}, 300);
			}
		}
	}, [focusedPage, document.pages]);

	// Attach document-level mouse listeners during drag for cross-page dragging
	useEffect(() => {
		if (dragState?.active || inlineDragState?.active) {
			const doc = window.document;
			doc.addEventListener("mousemove", handleDocumentMouseMove);
			doc.addEventListener("mouseup", handleDocumentMouseUp);
			return () => {
				doc.removeEventListener("mousemove", handleDocumentMouseMove);
				doc.removeEventListener("mouseup", handleDocumentMouseUp);
			};
		}
	}, [dragState?.active, inlineDragState?.active, handleDocumentMouseMove, handleDocumentMouseUp]);

	const handleSave = async () => {
		if (saving) return;

		setSaving(true);
		try {
			// Build RFC 6902 patch operations for document-level changes
			const hasClassChange = editClass !== document.document_type;
			const hasDescriptionChange = editDescription !== (document.description ?? "");
			const hasPeriodChange =
				editPeriodStart !== (document.effective_period?.period_start ?? "") ||
				editPeriodEnd !== (document.effective_period?.period_end ?? "");

			const patch: PatchOperation[] = [];
			const basePath = `/extractions/documents/${docIndex}`;

			if (hasClassChange) {
				patch.push({
					op: "replace",
					path: `${basePath}/document_type`,
					value: editClass,
				});
			}

			if (hasDescriptionChange) {
				patch.push({
					op: document.description ? "replace" : "add",
					path: `${basePath}/description`,
					value: editDescription,
				});
			}

			if (hasPeriodChange) {
				const hasPeriod = document.effective_period != null;
				patch.push({
					op: hasPeriod ? "replace" : "add",
					path: `${basePath}/effective_period`,
					value: {
						period_start: editPeriodStart || undefined,
						period_end: editPeriodEnd || undefined,
					},
				});
				// Also update period_status to determined when user sets a period
				if (editPeriodStart || editPeriodEnd) {
					patch.push({
						op: "replace",
						path: `${basePath}/period_status`,
						value: "determined",
					});
				}
			}

			if (patch.length > 0) {
				await patchCase(caseId, {
					patch,
					description: "Updated document classification/period",
				});
				onUpdate?.();
			}
			setShowEditPanel(false);
		} catch (err) {
			console.error("Failed to save:", err);
			alert("Failed to save changes");
		} finally {
			setSaving(false);
		}
	};

	const hasChanges =
		editClass !== document.document_type ||
		editDescription !== (document.description ?? "") ||
		editPeriodStart !== (document.effective_period?.period_start ?? "") ||
		editPeriodEnd !== (document.effective_period?.period_end ?? "");

	const docClassInfo = getDocClassInfo(document.document_type);

	return (
		<div className="h-full flex flex-col bg-slate-900">
			{/* Header */}
			<div className="px-4 py-3 bg-slate-800 border-b border-slate-700">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						{/* Document icon */}
						<div
							className={`w-10 h-10 rounded-lg flex items-center justify-center ${
								isPeriodUndetermined
									? "bg-yellow-500/20"
									: docClassInfo.isCustom
										? "bg-slate-500/20"
										: "bg-blue-500/20"
							}`}
						>
							<svg
								className={`w-5 h-5 ${isPeriodUndetermined ? "text-yellow-400" : docClassInfo.isCustom ? "text-slate-400" : "text-blue-400"}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
						</div>
						<div>
							<div className="flex items-center gap-2">
								<span
									className={`px-2 py-0.5 text-xs font-bold rounded ${
										document.processing_status && document.processing_status !== "complete"
											? "bg-orange-500 text-white animate-pulse"
											: docClassInfo.isCustom
												? "bg-slate-500 text-white"
												: "bg-blue-500 text-white"
									}`}
								>
									{document.processing_status && document.processing_status !== "complete"
										? "PROCESSING"
										: docClassInfo.isCustom
											? "SUPPORTING"
											: "STANDARD"}
								</span>
								<span
									className="text-white font-medium truncate max-w-xs"
									title={docClassInfo.displayName}
								>
									{docClassInfo.displayName}
								</span>
								{document.processing_status && document.processing_status !== "complete" && (
									<span className="px-2 py-0.5 text-xs rounded bg-orange-500/20 text-orange-400">
										{document.processing_message || document.processing_status}
									</span>
								)}
							</div>
							<div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
								<span>
									{sortedPages.length} page{sortedPages.length !== 1 ? "s" : ""}
								</span>
								<span>•</span>
								<span>
									Pages {sortedPages[0]?.page_number}-
									{sortedPages[sortedPages.length - 1]?.page_number}
								</span>
								{(document.effective_period?.period_start ||
									document.effective_period?.period_end) && (
									<>
										<span>•</span>
										<span title="Effective period">
											{[
												document.effective_period?.period_start,
												document.effective_period?.period_end,
											]
												.filter(Boolean)
												.map((d) =>
													new Date(d!).toLocaleDateString("en-US", {
														year: "numeric",
														month: "short",
														day: "numeric",
													}),
												)
												.join(" – ")}
										</span>
									</>
								)}
							</div>
						</div>
					</div>

					<div className="flex items-center gap-2">
						{/* Action buttons - only show when not classified */}
						{document.processing_status !== "classified" && (
							<>
								{bboxEditMode === "view" ? (
									<>
										{/* Add new fact button - always visible in view mode */}
										<button
											onClick={() => setBboxEditMode("create")}
											className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-600/30"
											title="Click on page to add a new fact"
										>
											<svg
												className="w-4 h-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M12 4v16m8-8H4"
												/>
											</svg>
											Add Fact
										</button>
										{/* Edit: opens both classification panel and bounding box edit mode */}
										<button
											type="button"
											onClick={() => {
												setShowEditPanel(true);
												setBboxEditMode("edit");
											}}
											className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
												showEditPanel
													? "bg-action text-white"
													: "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white"
											}`}
											title="Edit classification and bounding boxes"
										>
											<svg
												className="w-4 h-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													strokeWidth={2}
													d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
												/>
											</svg>
											Edit
										</button>
									</>
								) : bboxEditMode === "create" ? (
									<>
										{/* Cancel create mode */}
										<button
											onClick={() => setBboxEditMode("view")}
											className="px-3 py-1.5 text-sm rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-700"
										>
											Cancel
										</button>
										<div className="px-3 py-1.5 text-sm text-slate-400">
											Click on page to place fact
										</div>
									</>
								) : (
									<>
										{/* Save/Cancel buttons when in edit mode */}
										<button
											onClick={cancelBboxEdits}
											className="px-3 py-1.5 text-sm rounded-lg transition-colors text-slate-400 hover:text-white hover:bg-slate-700"
										>
											Cancel
										</button>
										<button
											onClick={savePendingEdits}
											disabled={savingFactEdits || (pendingFactEdits.size === 0 && !newFactDraft)}
											className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
												(pendingFactEdits.size > 0 || newFactDraft) && !savingFactEdits
													? "bg-green-600 text-white hover:bg-green-700"
													: "bg-slate-600 text-slate-400 cursor-not-allowed"
											}`}
										>
											{savingFactEdits ? (
												<>
													<svg
														className="w-4 h-4 animate-spin"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
														/>
													</svg>
													Saving...
												</>
											) : (
												<>
													<svg
														className="w-4 h-4"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M5 13l4 4L19 7"
														/>
													</svg>
													Save Changes
												</>
											)}
										</button>
									</>
								)}
							</>
						)}
					</div>
				</div>

				{/* Period Undetermined Warning Banner */}
				{isPeriodUndetermined && !showEditPanel && (
					<div
						className={`mt-3 p-3 rounded-lg border ${
							isAgentStillProcessing
								? "bg-orange-500/10 border-orange-500/30"
								: "bg-yellow-500/10 border-yellow-500/30"
						}`}
					>
						<div className="flex items-center gap-3">
							<div className="shrink-0">
								{isAgentStillProcessing ? (
									<svg
										className="w-6 h-6 text-orange-400 animate-spin"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
										/>
									</svg>
								) : (
									<svg
										className="w-6 h-6 text-yellow-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										/>
									</svg>
								)}
							</div>
							<div className="flex-1">
								<p
									className={`text-sm font-medium ${isAgentStillProcessing ? "text-orange-400" : "text-yellow-400"}`}
								>
									{isAgentStillProcessing ? "Agent Still Processing..." : "Period Not Determined"}
								</p>
								<p
									className={`text-xs mt-0.5 ${isAgentStillProcessing ? "text-orange-400/70" : "text-yellow-400/70"}`}
								>
									{isAgentStillProcessing
										? "The agent is still analyzing this document. Period will be determined when processing completes."
										: "Agent completed but could not determine the effective period. Set it manually to enable validation."}
								</p>
							</div>
							{!isAgentStillProcessing && (
								<button
									onClick={() => setShowEditPanel(true)}
									className="px-3 py-1.5 text-xs font-medium bg-yellow-500 text-slate-900 rounded-lg hover:bg-yellow-400 transition-colors shrink-0"
								>
									Set Period
								</button>
							)}
						</div>
					</div>
				)}

				{/* Edit Panel */}
				{showEditPanel && (
					<div className="mt-4 p-4 bg-slate-700/50 rounded-lg">
						{isCustomType ? (
							/* SUPPORTING (custom) documents: MISMO type dropdown + description text field */
							<div className="space-y-4">
								<div className="grid grid-cols-2 gap-4">
									{/* MISMO Classification - all known types */}
									<div>
										<label className="block text-xs font-medium text-slate-400 mb-1">
											MISMO Classification
										</label>
										<select
											value={editClass}
											onChange={(e) => setEditClass(e.target.value)}
											className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
										>
											{/* Current custom type at top */}
											{!isMISMOStandard(document.document_type) && (
												<option value={document.document_type}>
													{document.document_type} (current - SUPPORTING)
												</option>
											)}
											{/* All known MISMO types - selecting one converts to STANDARD */}
											<optgroup label="Select MISMO type to convert to STANDARD">
												{documentClasses.map((dc) => (
													<option key={dc.value} value={dc.value}>
														{dc.display_name}
													</option>
												))}
											</optgroup>
										</select>
										<p className="text-xs text-slate-500 mt-1">
											Select a MISMO type to convert from SUPPORTING to STANDARD
										</p>
									</div>

									{/* Description - LLM/human provided name */}
									<div>
										<label className="block text-xs font-medium text-slate-400 mb-1">
											Description
										</label>
										<input
											type="text"
											value={editDescription}
											onChange={(e) => setEditDescription(e.target.value)}
											placeholder="e.g., State Tax Form, Custom Statement"
											className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
										/>
										<p className="text-xs text-slate-500 mt-1">
											Human-readable name for this document
										</p>
									</div>
								</div>

								{/* Period fields */}
								<div className="grid grid-cols-2 gap-4">
									<div>
										<label className="block text-xs font-medium text-slate-400 mb-1">
											Period Start
										</label>
										<input
											type="date"
											value={editPeriodStart}
											onChange={(e) => setEditPeriodStart(e.target.value)}
											className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
										/>
									</div>
									<div>
										<label className="block text-xs font-medium text-slate-400 mb-1">
											Period End
										</label>
										<input
											type="date"
											value={editPeriodEnd}
											onChange={(e) => setEditPeriodEnd(e.target.value)}
											className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
										/>
									</div>
								</div>
							</div>
						) : (
							/* STANDARD (MISMO) documents: Full dropdown + period fields */
							<div className="grid grid-cols-3 gap-4">
								{/* Classification dropdown */}
								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1">
										Document Classification
									</label>
									<select
										value={editClass}
										onChange={(e) => setEditClass(e.target.value)}
										className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
									>
										<option value={document.document_type}>
											{getDocClassName(document.document_type)}
										</option>
										{documentClasses
											.filter((dc) => dc.value !== document.document_type)
											.map((dc) => (
												<option key={dc.value} value={dc.value}>
													{dc.display_name}
												</option>
											))}
									</select>
								</div>

								{/* Period Start */}
								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1">
										Period Start
									</label>
									<input
										type="date"
										value={editPeriodStart}
										onChange={(e) => setEditPeriodStart(e.target.value)}
										className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
									/>
								</div>

								{/* Period End */}
								<div>
									<label className="block text-xs font-medium text-slate-400 mb-1">
										Period End
									</label>
									<input
										type="date"
										value={editPeriodEnd}
										onChange={(e) => setEditPeriodEnd(e.target.value)}
										className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>
						)}

						{/* Save/Cancel buttons */}
						<div className="flex justify-end gap-2 mt-4">
							<button
								onClick={() => {
									setShowEditPanel(false);
									setEditClass(document.document_type);
									setEditDescription(document.description ?? "");
									setEditPeriodStart(document.effective_period?.period_start ?? "");
									setEditPeriodEnd(document.effective_period?.period_end ?? "");
								}}
								className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleSave}
								disabled={!hasChanges || saving}
								className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${
									hasChanges && !saving
										? "bg-action text-white hover:bg-action-hover"
										: "bg-slate-600 text-slate-400 cursor-not-allowed"
								}`}
							>
								{saving ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Main Content Area */}
			<div className="flex-1 flex overflow-hidden">
				{/* Page Images - Scrollable */}
				<div className="flex-1 overflow-y-auto p-4 space-y-4">
					{/* Wait for auth token before loading images to avoid 401 errors */}
					{!authReady ? (
						<div className="flex flex-col items-center justify-center h-64 text-slate-400">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3" />
							<span className="text-sm">Loading document...</span>
						</div>
					) : (
						sortedPages.map((page) => {
							const imageUrl = getPageImageUrl(caseId, page.file_id, page.page_number, authToken);
							const isLoading = loadingPages.has(page.page_number);

							return (
								<div
									key={`${page.file_id}-${page.page_number}`}
									ref={(el) => {
										if (el) pageRefs.current.set(page.page_number, el);
									}}
									className="relative"
								>
									{/* Page header with badge and re-extract button */}
									<div className="absolute top-2 left-2 z-10 flex items-center gap-2">
										<div className="px-2 py-1 rounded text-xs font-medium bg-slate-800/80 text-white">
											Page {page.page_number}
										</div>

										{/* Re-extract button */}
										{_reextractingPage === page.page_number ? (
											<div className="px-2 py-1 bg-action/80 rounded text-xs text-white flex items-center gap-1">
												<div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
												Re-extracting...
											</div>
										) : _showReextractConfirm === page.page_number ? (
											<div className="flex items-center gap-1">
												<button
													onClick={() => _handleReextractPage(page)}
													className="px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-xs text-white font-medium"
												>
													Confirm
												</button>
												<button
													onClick={() => setShowReextractConfirm(null)}
													className="px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs text-white font-medium"
												>
													Cancel
												</button>
											</div>
										) : (
											<button
												onClick={() => setShowReextractConfirm(page.page_number)}
												className="px-2 py-1 bg-slate-700/80 hover:bg-orange-600 rounded text-xs text-white font-medium transition-colors"
												title="Re-extract this page (discards manual edits)"
											>
												Re-extract
											</button>
										)}
									</div>

									{/* Page image with bounding box overlay */}
									{
										<div
											className={`relative ${bboxEditMode === "create" ? "cursor-crosshair" : ""} ${activeInlineEdit?.pageNumber === page.page_number ? "cursor-default" : ""}`}
											ref={(el) => {
												if (el) {
													const rect = el.getBoundingClientRect();
													pageContainerRefs.current.set(page.page_number, {
														el,
														width: rect.width,
														height: rect.height,
													});
												}
											}}
											onClick={(e) => {
												// In view mode with active inline edit, clicking outside bbox cancels it
												if (activeInlineEdit && bboxEditMode === "view") {
													// Don't cancel if clicking on the bbox or panel itself
													return;
												}
												handlePageClick(e, page.page_number);
											}}
											onMouseLeave={() => {
												// Only handle mouse leave for non-drag interactions
												// Drag operations are handled by document-level listeners
												if (!dragState?.active && !inlineDragState?.active) {
													// Handle any cleanup needed when mouse leaves page
												}
											}}
										>
											{/* Page highlight ring when this page is targeted (only when not in inline edit mode) */}
											{highlightedPageNumber === page.page_number &&
												!isLoading &&
												bboxEditMode === "view" &&
												!activeInlineEdit && (
													<div className="absolute inset-0 rounded-lg ring-2 ring-orange-400 ring-offset-2 ring-offset-slate-900 pointer-events-none z-10" />
												)}

											{/* Create mode hint */}
											{bboxEditMode === "create" && !isLoading && (
												<div className="absolute top-2 right-2 px-2 py-1 bg-green-500/90 text-white text-xs rounded flex items-center gap-1 z-20">
													<svg
														className="w-3 h-3"
														fill="none"
														viewBox="0 0 24 24"
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															strokeWidth={2}
															d="M12 4v16m8-8H4"
														/>
													</svg>
													Click to place new fact
												</div>
											)}

											<PageImageLoader
												src={imageUrl}
												alt={`Page ${page.page_number}`}
												pageNumber={page.page_number}
												className={`${
													highlightedPageNumber === page.page_number &&
													bboxEditMode === "view" &&
													!activeInlineEdit
														? "ring-2 ring-orange-400/50"
														: ""
												} ${bboxEditMode !== "view" || activeInlineEdit ? "select-none" : ""}`}
												onLoad={() => handleImageLoad(page.page_number)}
												onError={() => {
													setLoadingPages((prev) => {
														const next = new Set(prev);
														next.delete(page.page_number);
														return next;
													});
													setErrorPages((prev) => new Set(prev).add(page.page_number));
												}}
												preloadUrls={getPreloadUrls(page.page_number)}
											/>

											{/* Progressive display: extracting overlay for classified documents */}
											{!isLoading && document.processing_status === "classified" && (
												<div className="absolute inset-0 bg-slate-900/20 flex items-center justify-center pointer-events-none">
													<div className="bg-slate-800/90 px-4 py-3 rounded-lg flex items-center gap-3 shadow-lg">
														<div className="w-5 h-5 border-2 border-orange-400/30 border-t-orange-400 rounded-full animate-spin" />
														<span className="text-sm text-orange-400 font-medium">
															Extracting facts...
														</span>
													</div>
												</div>
											)}

											{/* View mode: static bounding box overlays - show ALL facts with bboxes as clickable */}
											{/* Hide overlays for classified documents since there are no facts yet */}
											{!isLoading &&
												bboxEditMode === "view" &&
												!activeInlineEdit &&
												document.processing_status !== "classified" &&
												document.facts?.flatMap((fact, factIdx) => {
													// Use sources array if available (has page_number), fall back to legacy bbox
													if (fact.sources && fact.sources.length > 0) {
														return fact.sources
															.filter((src) => src.page_number === page.page_number && src.bbox)
															.map((src, srcIdx) => {
																const bbox = src.bbox!;
																const isHighlighted = highlightedSources.some(
																	(hs) =>
																		hs.page_number === src.page_number &&
																		hs.bbox &&
																		Math.abs((hs.bbox.x1 ?? 0) - (bbox.x1 ?? 0)) < 0.001 &&
																		Math.abs((hs.bbox.y1 ?? 0) - (bbox.y1 ?? 0)) < 0.001 &&
																		Math.abs((hs.bbox.x2 ?? 0) - (bbox.x2 ?? 0)) < 0.001 &&
																		Math.abs((hs.bbox.y2 ?? 0) - (bbox.y2 ?? 0)) < 0.001,
																);
																return (
																	<BoundingBoxOverlay
																		key={`fact-${factIdx}-src-${srcIdx}`}
																		bbox={bbox}
																		isPrimary={isHighlighted}
																		onClick={() => {
																			startInlineEdit(factIdx, fact);
																		}}
																	/>
																);
															});
													}
													// Legacy: use bbox with page_number field (if set)
													if (fact.bbox && fact.bbox.page_number === page.page_number) {
														const bbox = fact.bbox;
														const isHighlighted = highlightedSources.some(
															(src) =>
																src.page_number === bbox.page_number &&
																src.bbox &&
																Math.abs((src.bbox.x1 ?? 0) - (bbox.x1 ?? 0)) < 0.001 &&
																Math.abs((src.bbox.y1 ?? 0) - (bbox.y1 ?? 0)) < 0.001 &&
																Math.abs((src.bbox.x2 ?? 0) - (bbox.x2 ?? 0)) < 0.001 &&
																Math.abs((src.bbox.y2 ?? 0) - (bbox.y2 ?? 0)) < 0.001,
														);
														return [
															<BoundingBoxOverlay
																key={`fact-${factIdx}`}
																bbox={bbox}
																isPrimary={isHighlighted}
																onClick={() => {
																	startInlineEdit(factIdx, fact);
																}}
															/>,
														];
													}
													return [];
												})}

											{/* Inline edit mode: Interactive bbox with drag handles (view mode) - hide for classified docs */}
											{!isLoading &&
												document.processing_status !== "classified" &&
												activeInlineEdit &&
												activeInlineEdit.pageNumber === page.page_number && (
													<>
														<InteractiveBoundingBox
															bbox={activeInlineEdit.bbox}
															pageNumber={page.page_number}
															isNew={activeInlineEdit.isNew}
															isDragging={!!inlineDragState?.active}
															hasChanges={
																activeInlineEdit.isNew ||
																activeInlineEdit.bbox.x1 !== activeInlineEdit.fact.bbox?.x1 ||
																activeInlineEdit.bbox.y1 !== activeInlineEdit.fact.bbox?.y1 ||
																activeInlineEdit.bbox.x2 !== activeInlineEdit.fact.bbox?.x2 ||
																activeInlineEdit.bbox.y2 !== activeInlineEdit.fact.bbox?.y2 ||
																activeInlineEdit.value !== String(activeInlineEdit.fact.value ?? "")
															}
															isSaving={savingFactEdits}
															onDragStart={(e, type) =>
																handleInlineDragStart(e, page.page_number, type)
															}
															onConfirm={saveInlineEdit}
															onCancel={cancelInlineEdit}
														/>
														<InlineEditPanel
															edit={activeInlineEdit}
															containerRef={
																pageContainerRefs.current.get(page.page_number)?.el ?? null
															}
															onFieldNameChange={updateInlineEditFieldName}
															onValueChange={updateInlineEditValue}
															onSave={saveInlineEdit}
															onCancel={cancelInlineEdit}
															saving={savingFactEdits}
														/>
													</>
												)}

											{/* Edit mode: interactive bounding boxes for all facts with bbox on this page */}
											{!isLoading &&
												bboxEditMode !== "view" &&
												document.facts?.map((fact, factIdx) => {
													const effectiveBbox = getEffectiveBbox(factIdx);
													if (!effectiveBbox || effectiveBbox.page_number !== page.page_number)
														return null;

													const isPending = pendingFactEdits.has(factIdx);
													const isEditing = editingFactIndex === factIdx;

													return (
														<EditableBoundingBox
															key={factIdx}
															bbox={effectiveBbox}
															factIndex={factIdx}
															pageNumber={page.page_number}
															isPending={isPending}
															isEditing={isEditing}
															isDragging={dragState?.factIndex === factIdx}
															isSaving={savingSingleFactIndex === factIdx}
															onMouseDown={handleBboxMouseDown}
															onClick={() => {
																setEditingFactIndex(factIdx);
																startBboxEdit(factIdx, fact);
															}}
															onConfirm={() => confirmSingleBboxEdit(factIdx)}
														/>
													);
												})}

											{/* New fact draft bbox (when creating) */}
											{!isLoading &&
												newFactDraft &&
												newFactDraft.pageNumber === page.page_number && (
													<EditableBoundingBox
														bbox={newFactDraft.bbox}
														factIndex={-1}
														pageNumber={page.page_number}
														isPending={true}
														isEditing={true}
														isDragging={false}
														onMouseDown={() => {}}
														onClick={() => {}}
														isNew
													/>
												)}

											{/* Show "no bbox" indicator when page is highlighted but no bbox data (view mode only, not during inline edit) */}
											{!isLoading &&
												bboxEditMode === "view" &&
												!activeInlineEdit &&
												highlightedPageNumber === page.page_number &&
												!highlightedSources.some(
													(src) => src.page_number === page.page_number && src.bbox,
												) && (
													<div className="absolute top-2 right-2 px-2 py-1 bg-orange-500/90 text-white text-xs rounded flex items-center gap-1 z-20">
														<svg
															className="w-3 h-3"
															fill="none"
															viewBox="0 0 24 24"
															stroke="currentColor"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
															/>
														</svg>
														Fact on this page
													</div>
												)}
										</div>
									}
								</div>
							);
						})
					)}
				</div>

				{/* Right Sidebar - Facts & Parties */}
				<div className="w-80 border-l border-slate-700 bg-slate-800/50 flex flex-col overflow-hidden">
					{/* Facts Section */}
					<div className="flex-1 overflow-y-auto">
						<div className="p-3 border-b border-slate-700">
							<div className="flex items-center justify-between">
								<h3 className="text-sm font-medium text-white flex items-center gap-2">
									<svg
										className="w-4 h-4 text-green-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
										/>
									</svg>
									Extractions ({document.facts?.length ?? document.facts_count})
									{pendingFactEdits.size > 0 && (
										<span className="ml-auto px-1.5 py-0.5 text-[10px] bg-yellow-500/20 text-yellow-400 rounded">
											{pendingFactEdits.size} modified
										</span>
									)}
								</h3>
								{/* View Tables button */}
								<button
									onClick={() => setShowTableModal(true)}
									className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
									title="View extracted data regions"
								>
									<svg
										className="w-3.5 h-3.5"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
										/>
									</svg>
									Data
								</button>
							</div>
							<p className="text-xs text-slate-500 mt-1">
								{bboxEditMode !== "view"
									? "Click a fact to edit its value and bounding box"
									: "Click a fact to highlight on page"}
							</p>
						</div>

						{/* New Fact Form (when draft exists) */}
						{newFactDraft && (
							<div className="p-3 border-b border-slate-700 bg-green-500/5">
								<div className="flex items-center gap-2 mb-2">
									<svg
										className="w-4 h-4 text-green-400"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth={2}
											d="M12 4v16m8-8H4"
										/>
									</svg>
									<span className="text-sm font-medium text-green-400">New Fact</span>
									<button
										onClick={() => setNewFactDraft(null)}
										className="ml-auto p-1 text-slate-400 hover:text-white rounded"
										title="Cancel"
									>
										<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</div>
								<div className="space-y-2">
									<input
										type="text"
										value={newFactDraft.field_name}
										onChange={(e) =>
											setNewFactDraft({ ...newFactDraft, field_name: e.target.value })
										}
										placeholder="Field name (e.g., gross_income)"
										className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500"
									/>
									<input
										type="text"
										value={newFactDraft.value}
										onChange={(e) => setNewFactDraft({ ...newFactDraft, value: e.target.value })}
										placeholder="Value"
										className="w-full px-2 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-green-500"
									/>
									<p className="text-[10px] text-slate-500">
										Page {newFactDraft.pageNumber} • Drag the green box to adjust position
									</p>
								</div>
							</div>
						)}

						<FactsList
							facts={sortedFacts}
							selectedFact={selectedFact}
							pendingFactEdits={pendingFactEdits}
							editingFactIndex={editingFactIndex}
							inlineEditingFactIndex={activeInlineEdit?.factIndex ?? null}
							isEditMode={bboxEditMode !== "view"}
							loadingMessage="Loading facts..."
							emptyMessage={document.facts_count > 0 ? "Loading facts..." : "No facts extracted"}
							factRefs={factRefs}
							onFactClick={(fact, originalIndex) => {
								if (bboxEditMode !== "view") {
									setEditingFactIndex(originalIndex);
									startBboxEdit(originalIndex, fact);
								} else {
									handleFactClick(fact, originalIndex);
								}
							}}
							onValueChange={(originalIndex, newValue) => {
								const fact = document.facts?.[originalIndex];
								if (fact && !pendingFactEdits.has(originalIndex)) {
									startBboxEdit(originalIndex, fact);
								}
								updatePendingValue(originalIndex, newValue);
							}}
						/>
					</div>
				</div>
			</div>

			{/* Table View Modal */}
			<TableViewModal
				open={showTableModal}
				caseId={caseId}
				fileId={document.file_id}
				documentType={document.document_type}
				onClose={() => setShowTableModal(false)}
			/>
		</div>
	);
}
