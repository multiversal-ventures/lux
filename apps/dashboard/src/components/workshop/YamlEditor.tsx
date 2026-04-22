import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";

interface YamlEditorProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	readOnly?: boolean;
}

const editorTheme = EditorView.theme({
	"&": {
		height: "100%",
		fontSize: "13px",
	},
	".cm-scroller": {
		fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
	},
	".cm-content": {
		padding: "8px 0",
		color: "#0f172a", // slate-900 - black text
	},
	".cm-line": {
		padding: "0 8px",
		color: "#0f172a", // slate-900 - black text
	},
	".cm-gutters": {
		backgroundColor: "#f8fafc",
		color: "#94a3b8",
		border: "none",
		borderRight: "1px solid #e2e8f0",
	},
	".cm-activeLineGutter": {
		backgroundColor: "#f1f5f9",
	},
	".cm-activeLine": {
		backgroundColor: "#f8fafc",
	},
});

export function YamlEditor({ value, onChange, placeholder, readOnly }: YamlEditorProps) {
	return (
		<div className="h-full border border-slate-300 rounded-lg overflow-hidden">
			<CodeMirror
				value={value}
				onChange={onChange}
				extensions={[yaml(), editorTheme]}
				placeholder={placeholder}
				readOnly={readOnly}
				basicSetup={{
					lineNumbers: true,
					highlightActiveLineGutter: true,
					highlightActiveLine: true,
					foldGutter: true,
					dropCursor: true,
					allowMultipleSelections: true,
					indentOnInput: true,
					bracketMatching: true,
					closeBrackets: true,
					autocompletion: true,
					rectangularSelection: true,
					crosshairCursor: false,
					highlightSelectionMatches: true,
					tabSize: 2,
				}}
				style={{ height: "100%" }}
			/>
		</div>
	);
}
