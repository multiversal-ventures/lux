import { type CSSProperties, useCallback, useState } from "react";

export type CodeBlockProps = {
	/** Source text shown and copied */
	code: string;
	/** Optional short label for screen readers */
	label?: string;
};

/**
 * Read-only code with a copy button for integration snippets.
 */
export function CodeBlock({ code, label = "Code sample" }: CodeBlockProps) {
	const [copied, setCopied] = useState(false);

	const copy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}, [code]);

	return (
		<div style={wrap}>
			<div style={toolbar}>
				<button type="button" style={copyBtn} onClick={copy} aria-label={`Copy ${label}`}>
					{copied ? "Copied" : "Copy"}
				</button>
			</div>
			<pre style={pre}>
				<code>{code}</code>
			</pre>
		</div>
	);
}

const wrap: CSSProperties = {
	position: "relative",
	marginTop: ".75rem",
	border: "1px solid #e0e0e0",
	borderRadius: 6,
	background: "#fff",
	overflow: "hidden",
};

const toolbar: CSSProperties = {
	display: "flex",
	justifyContent: "flex-end",
	padding: ".35rem .5rem",
	borderBottom: "1px solid #eee",
	background: "#f7f7f7",
};

const copyBtn: CSSProperties = {
	fontSize: ".75rem",
	padding: ".25rem .5rem",
	border: "1px solid #ccc",
	borderRadius: 4,
	background: "#fff",
	cursor: "pointer",
};

const pre: CSSProperties = {
	margin: 0,
	padding: ".75rem 1rem",
	fontSize: ".8rem",
	lineHeight: 1.45,
	overflow: "auto",
	whiteSpace: "pre-wrap",
	wordBreak: "break-word",
	fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
};
