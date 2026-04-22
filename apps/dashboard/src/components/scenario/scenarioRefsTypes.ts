import type { SourceRef } from "../../types";

export interface RefRow {
	partyName: string;
	sectionName: string;
	rowLabel: string;
	refs: SourceRef[];
	sourceLine?: string;
	sign?: string;
	y1?: number | null;
	y2?: number | null;
}
