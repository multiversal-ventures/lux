import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Fact } from "../types";

/**
 * App-level UI state.
 *
 * Note: Stream status is NOT stored here - it's managed by useGunnrCase hook
 * and passed as props. This follows the principle from versioned-state.md:
 * "Backend is the source of truth, SSE triggers refetch, not local update"
 *
 * Files and documents come from SSE events and API results (backed by GCS) - NOT stored locally.
 * The frontend "bolts on" to the single source of truth.
 */
interface AppState {
	sidebarCollapsed: boolean;
	sidebarUserInteracted: boolean;
	documentsSidebarCollapsed: boolean;
	currentCaseId: string | null;
	currentCaseName: string | null;
	pendingEdits: Record<string, Fact[]>;
	tenantId: string | null;
	tenantName: string | null;
	selectedLoanProduct: string | null;
}

const initialState: AppState = {
	sidebarCollapsed: true,
	sidebarUserInteracted: false,
	documentsSidebarCollapsed: false,
	currentCaseId: null,
	currentCaseName: null,
	pendingEdits: {},
	tenantId: null,
	tenantName: null,
	selectedLoanProduct: "fannie_mae",
};

const appSlice = createSlice({
	name: "app",
	initialState,
	reducers: {
		toggleSidebar(state) {
			state.sidebarCollapsed = !state.sidebarCollapsed;
			state.sidebarUserInteracted = true;
		},
		setSidebarCollapsed(state, action: PayloadAction<boolean>) {
			state.sidebarCollapsed = action.payload;
		},
		/** Collapse sidebar and mark as user-interacted so auto-expand effect does not re-open it */
		collapseSidebarForView(state) {
			state.sidebarCollapsed = true;
			state.sidebarUserInteracted = true;
		},
		resetSidebarInteraction(state) {
			state.sidebarUserInteracted = false;
		},
		toggleDocumentsSidebar(state) {
			state.documentsSidebarCollapsed = !state.documentsSidebarCollapsed;
		},
		setDocumentsSidebarCollapsed(state, action: PayloadAction<boolean>) {
			state.documentsSidebarCollapsed = action.payload;
		},
		setCurrentCaseId(state, action: PayloadAction<string | null>) {
			state.currentCaseId = action.payload;
		},
		setCurrentCaseName(state, action: PayloadAction<string | null>) {
			state.currentCaseName = action.payload;
		},
		setPendingEdits(state, action: PayloadAction<{ pageKey: string; facts: Fact[] }>) {
			state.pendingEdits[action.payload.pageKey] = action.payload.facts;
		},
		clearPendingEdits(state, action: PayloadAction<string>) {
			delete state.pendingEdits[action.payload];
		},
		clearAllPendingEdits(state) {
			state.pendingEdits = {};
		},
		setTenantId(state, action: PayloadAction<string | null>) {
			state.tenantId = action.payload;
		},
		setTenantName(state, action: PayloadAction<string | null>) {
			state.tenantName = action.payload;
		},
		setSelectedLoanProduct(state, action: PayloadAction<string | null>) {
			state.selectedLoanProduct = action.payload;
		},
	},
});

export const {
	toggleSidebar,
	setSidebarCollapsed,
	collapseSidebarForView,
	resetSidebarInteraction,
	toggleDocumentsSidebar,
	setDocumentsSidebarCollapsed,
	setCurrentCaseId,
	setCurrentCaseName,
	setPendingEdits,
	clearPendingEdits,
	clearAllPendingEdits,
	setTenantId,
	setTenantName,
	setSelectedLoanProduct,
} = appSlice.actions;

export default appSlice.reducer;
