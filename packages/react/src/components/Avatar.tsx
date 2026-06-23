/**
 * A small chat avatar: a circular photo when one is supplied, otherwise a
 * deterministic colored circle bearing the speaker's initials. Used to give the
 * portal chats a human face — the loan officer (real photo, captured via webcam)
 * and the borrower (initials only; borrowers never set a photo).
 */

/** Eight pleasant, well-separated background colors. The name hashes into this
 * palette so the same person always gets the same color across renders. */
const PALETTE = [
	"#4f46e5", // indigo
	"#0891b2", // cyan
	"#059669", // emerald
	"#d97706", // amber
	"#dc2626", // red
	"#db2777", // pink
	"#7c3aed", // violet
	"#2563eb", // blue
] as const;

/** Up to two initials: first letters of the first and last words. "?" when the
 * name is empty/blank so the circle is never visually empty. */
function initialsOf(name?: string): string {
	const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	const first = words[0]![0] ?? "";
	const last = words.length > 1 ? (words[words.length - 1]![0] ?? "") : "";
	return (first + last).toUpperCase() || "?";
}

/** Stable string hash → palette index. Deterministic per name. */
function colorFor(name?: string): string {
	const s = (name ?? "").trim();
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) | 0;
	}
	return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export interface AvatarProps {
	/** Display name — drives initials + the deterministic background color. */
	name?: string;
	/** A photo (data URL or http URL). Empty/null falls back to initials. */
	photoUrl?: string | null;
	/** Pixel diameter (square). Default 28. */
	size?: number;
	/** When given, renders as a button — used to open the webcam capture. */
	onClick?: () => void;
	/** Hover tooltip / accessible label. */
	title?: string;
}

export function Avatar({ name, photoUrl, size = 28, onClick, title }: AvatarProps) {
	const dimension = { width: size, height: size, minWidth: size } as const;
	const content = photoUrl ? (
		<img
			src={photoUrl}
			alt={title ?? name ?? "avatar"}
			className="h-full w-full rounded-full object-cover"
			draggable={false}
		/>
	) : (
		<span
			className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white select-none"
			style={{ backgroundColor: colorFor(name), fontSize: Math.round(size * 0.4) }}
		>
			{initialsOf(name)}
		</span>
	);

	if (onClick) {
		return (
			<button
				type="button"
				onClick={onClick}
				title={title}
				aria-label={title ?? "Change photo"}
				className="shrink-0 rounded-full ring-0 ring-indigo-300 transition hover:ring-2 focus:outline-none focus-visible:ring-2 cursor-pointer"
				style={dimension}
			>
				{content}
			</button>
		);
	}

	return (
		<span className="shrink-0 block" style={dimension} title={title}>
			{content}
		</span>
	);
}
