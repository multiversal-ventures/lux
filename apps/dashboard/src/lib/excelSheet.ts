/**
 * Shared Excel sheet parsing and rendering utilities using SheetJS.
 * Used by ExcelViewer (modal) and InlineExcelSheet (inline).
 */

import { utils } from "xlsx";

/** Map Excel cell style (.s) to CSS string for inline styles */
export function cellStyleToCss(s: Record<string, unknown> | undefined): string {
	if (!s || typeof s !== "object") return "";
	const parts: string[] = [];

	const fg = s.fgColor as { rgb?: string } | undefined;
	const bg = s.bgColor as { rgb?: string } | undefined;
	const patternType = s.patternType as string | undefined;
	if (patternType === "solid" && fg?.rgb) {
		const hex = rgbToHex(fg.rgb);
		if (hex) parts.push(`background-color:${hex}`);
	} else if (bg?.rgb) {
		const hex = rgbToHex(bg.rgb);
		if (hex) parts.push(`background-color:${hex}`);
	}

	const font = s.font as Record<string, unknown> | undefined;
	let hasExplicitColor = false;
	if (font) {
		if (font.bold) parts.push("font-weight:bold");
		if (font.italic) parts.push("font-style:italic");
		if (font.underline) parts.push("text-decoration:underline");
		if (font.sz) parts.push(`font-size:${font.sz}pt`);
		if (font.name) parts.push(`font-family:"${font.name}",sans-serif`);
		const fontColor = font.color as { rgb?: string } | undefined;
		if (fontColor?.rgb) {
			const hex = rgbToHex(fontColor.rgb);
			if (hex) {
				parts.push(`color:${hex}`);
				hasExplicitColor = true;
			}
		}
	}

	// When cell has dark background but no explicit font color, use white for readability
	if (!hasExplicitColor && parts.length > 0) {
		const bgPart = parts.find((p) => p.startsWith("background-color:"));
		if (bgPart) {
			const hex = bgPart.split(":")[1];
			if (hex && getLuminance(hex) < 0.4) {
				parts.push("color:#fff");
			}
		}
	}

	const align = s.alignment as Record<string, unknown> | undefined;
	if (align) {
		if (align.horizontal) parts.push(`text-align:${align.horizontal}`);
		if (align.vertical) parts.push(`vertical-align:${align.vertical}`);
	}

	const border = s.border as
		| Record<string, { style?: string; color?: { rgb?: string } }>
		| undefined;
	if (border) {
		const sides = ["top", "bottom", "left", "right"] as const;
		for (const side of sides) {
			const b = border[side];
			if (b?.style && b?.color?.rgb) {
				const hex = rgbToHex(b.color.rgb);
				const width = b.style === "thin" ? "1px" : b.style === "medium" ? "2px" : "1px";
				if (hex) parts.push(`border-${side}:${width} solid ${hex}`);
			}
		}
	}

	return parts.join(";");
}

/** Convert Excel ARGB hex (8 chars) to CSS #RRGGBB */
export function rgbToHex(rgb: string): string {
	if (!rgb || typeof rgb !== "string") return "";
	const s = rgb.replace(/^#/, "");
	if (s.length === 8) return "#" + s.slice(2);
	if (s.length === 6) return "#" + s;
	return "";
}

/** Relative luminance (0–1). Values < 0.4 are considered dark. */
function getLuminance(hex: string): number {
	if (!hex || hex.length < 7) return 0;
	const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
	const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
	const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
	return 0.299 * r + 0.587 * g + 0.114 * b;
}

const NUMERIC_RE = /^[\s$,()-]*\d[\d,]*\.?\d*[\s%]*$/;

function getCell(ws: Record<string, unknown>, R: number, C: number, dense: boolean) {
	const raw = dense ? (ws[R] as unknown[])?.[C] : ws[utils.encode_cell({ r: R, c: C })];
	return raw as
		| {
				v?: unknown;
				t?: string;
				w?: string;
				h?: string;
				s?: Record<string, unknown>;
				l?: { Target?: string };
		  }
		| undefined;
}

/** Find the last column that contains any non-empty value or merge span. */
function findLastUsedCol(
	ws: Record<string, unknown>,
	range: { s: { r: number; c: number }; e: { r: number; c: number } },
	merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>,
	dense: boolean,
): number {
	let maxCol = range.s.c;
	for (let R = range.s.r; R <= range.e.r; R++) {
		for (let C = range.e.c; C >= maxCol; C--) {
			const cell = getCell(ws, R, C, dense);
			if (cell && cell.v != null && String(cell.v).trim() !== "") {
				maxCol = Math.max(maxCol, C);
				break;
			}
		}
	}
	for (const m of merges) {
		if (m.e.c > maxCol) maxCol = Math.max(maxCol, m.e.c);
	}
	return maxCol;
}

/** Build HTML table from worksheet with cell styles applied */
export function sheetToHtmlWithStyles(ws: Record<string, unknown>): string {
	const ref = (ws["!ref"] as string) || "A1";
	let range: { s: { r: number; c: number }; e: { r: number; c: number } };
	try {
		range = utils.decode_range(ref);
	} catch {
		return "<table></table>";
	}
	const merges =
		(ws["!merges"] as Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>) || [];
	const dense = Array.isArray(ws);

	const lastCol = findLastUsedCol(ws, range, merges, dense);

	// Row metadata — SheetJS stores hidden/height info in !rows
	const rowMeta = (ws["!rows"] as Array<{ hidden?: boolean; hpt?: number } | undefined>) || [];

	const rows: string[] = [];
	for (let R = range.s.r; R <= range.e.r; R++) {
		const isHidden = rowMeta[R]?.hidden === true;
		const cells: string[] = [];
		for (let C = range.s.c; C <= lastCol; C++) {
			let RS = 0,
				CS = 0;
			for (const m of merges) {
				if (m.s.r > R || m.s.c > C) continue;
				if (m.e.r < R || m.e.c < C) continue;
				if (m.s.r < R || m.s.c < C) {
					RS = -1;
					break;
				}
				RS = m.e.r - m.s.r + 1;
				CS = m.e.c - m.s.c + 1;
				break;
			}
			if (RS < 0) continue;

			const cellObj = getCell(ws, R, C, dense);

			let text = "";
			if (cellObj && cellObj.v != null) {
				text = cellObj.h || cellObj.w || String(cellObj.v);
			}
			text = escapeHtml(text);

			if (cellObj?.l?.Target && !cellObj.l.Target.startsWith("#")) {
				text = `<a href="${escapeHtml(cellObj.l.Target)}">${text}</a>`;
			}

			const isNumeric = cellObj?.t === "n" || (text !== "" && NUMERIC_RE.test(text));

			const style = cellStyleToCss(cellObj?.s);
			const attrs: string[] = [];
			if (RS > 1) attrs.push(`rowspan="${RS}"`);
			if (CS > 1) attrs.push(`colspan="${CS}"`);
			if (style) attrs.push(`style="${style}"`);
			if (isNumeric) attrs.push('data-type="n"');

			cells.push(`<td ${attrs.join(" ")}>${text}</td>`);
		}
		const trAttrs = isHidden ? ' class="xlsx-hidden" style="display:none"' : "";
		rows.push(`<tr${trAttrs}>` + cells.join("") + "</tr>");
	}
	return "<table>" + rows.join("") + "</table>";
}

/** Decode HTML entities that may appear in source data (e.g. from Excel/API) */
function decodeHtmlEntities(s: string): string {
	return s
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"');
}

export function escapeHtml(s: string): string {
	return decodeHtmlEntities(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
