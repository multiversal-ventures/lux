import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { Fact } from "../types";

/**
 * App-level UI state only (case display name + tenant live on `VeritasSession` via `@fenero/lux-react` / `@fenero/lux-core`).
 */
interface AppState {
	sidebarCollapsed: boolean;
	sidebarUserInteracted: boolean;
	documentsSidebarCollapsed: boolean;
	pendingEdits: Record<string, Fact[]>;
	selectedLoanProduct: string | null;
}

const initialState: AppState = {
	sidebarCollapsed: true,
	sidebarUserInteracted: false,
	documentsSidebarCollapsed: false,
	pendingEdits: {},
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
		setPendingEdits(state, action: PayloadAction<{ pageKey: string; facts: Fact[] }>) {
			state.pendingEdits[action.payload.pageKey] = action.payload.facts;
		},
		clearPendingEdits(state, action: PayloadAction<string>) {
			delete state.pendingEdits[action.payload];
		},
		clearAllPendingEdits(state) {
			state.pendingEdits = {};
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
	setPendingEdits,
	clearPendingEdits,
	clearAllPendingEdits,
	setSelectedLoanProduct,
} = appSlice.actions;

export default appSlice.reducer;
