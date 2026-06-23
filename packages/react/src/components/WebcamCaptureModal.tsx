import { useCallback, useRef, useState } from "react";
import Webcam from "react-webcam";
import { Camera, RotateCcw, Trash2, X } from "lucide-react";

/** Output edge length of the saved avatar (square). Small enough to ship inline
 * as a data URL on every session/overview payload without bloating responses. */
const OUTPUT_SIZE = 256;

export interface WebcamCaptureModalProps {
	open: boolean;
	/** The photo currently in use (data URL), if any — enables "Remove photo". */
	currentPhoto?: string | null;
	/** Called with the new photo (data URL) on "Use photo", or `null` on "Remove photo". */
	onSave: (dataUrl: string | null) => void;
	onClose: () => void;
}

/**
 * Webcam capture modal for the loan-officer avatar. Shows a live preview, takes
 * a still on "Take photo", center-crops it to a {@link OUTPUT_SIZE}px square
 * JPEG, then lets the operator Retake or save with "Use photo". When a photo is
 * already in use, a "Remove photo" action clears it (saves `null`).
 *
 * Camera-permission denial is handled gracefully: react-webcam's `onUserMediaError`
 * flips to an inline message instead of a blank/broken preview.
 */
export function WebcamCaptureModal({ open, currentPhoto, onSave, onClose }: WebcamCaptureModalProps) {
	const webcamRef = useRef<Webcam>(null);
	const [captured, setCaptured] = useState<string | null>(null);
	const [denied, setDenied] = useState(false);

	// Center-crop the raw screenshot (whatever the camera's aspect ratio is) to a
	// square and downscale to OUTPUT_SIZE — "cover" semantics so the face fills
	// the circle without distortion.
	const cropToSquare = useCallback((src: string): Promise<string> => {
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const side = Math.min(img.width, img.height);
				const sx = (img.width - side) / 2;
				const sy = (img.height - side) / 2;
				const canvas = document.createElement("canvas");
				canvas.width = OUTPUT_SIZE;
				canvas.height = OUTPUT_SIZE;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					resolve(src);
					return;
				}
				ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
				resolve(canvas.toDataURL("image/jpeg", 0.8));
			};
			img.onerror = () => resolve(src);
			img.src = src;
		});
	}, []);

	const takePhoto = useCallback(async () => {
		const shot = webcamRef.current?.getScreenshot();
		if (!shot) return;
		setCaptured(await cropToSquare(shot));
	}, [cropToSquare]);

	function reset() {
		setCaptured(null);
		setDenied(false);
	}

	function close() {
		reset();
		onClose();
	}

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
			role="dialog"
			aria-modal="true"
			aria-label="Set your photo"
			onClick={close}
		>
			<div
				className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-base font-semibold text-slate-900">Your photo</h2>
					<button
						type="button"
						onClick={close}
						aria-label="Close"
						className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
					>
						<X size={18} />
					</button>
				</div>

				<div className="mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-xl bg-slate-100">
					{denied ? (
						<div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
							<Camera size={28} className="text-slate-400" />
							<p className="text-sm text-slate-600">Camera access is blocked.</p>
							<p className="text-xs text-slate-500">
								Allow camera access in your browser settings, then reopen this dialog.
							</p>
						</div>
					) : captured ? (
						<img src={captured} alt="Captured preview" className="h-full w-full object-cover" />
					) : (
						<Webcam
							ref={webcamRef}
							audio={false}
							screenshotFormat="image/jpeg"
							mirrored
							videoConstraints={{ facingMode: "user" }}
							onUserMediaError={() => setDenied(true)}
							className="h-full w-full object-cover"
						/>
					)}
				</div>

				<div className="mt-4 flex items-center justify-center gap-2">
					{denied ? (
						<button
							type="button"
							onClick={close}
							className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
						>
							Close
						</button>
					) : captured ? (
						<>
							<button
								type="button"
								onClick={reset}
								className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
							>
								<RotateCcw size={15} /> Retake
							</button>
							<button
								type="button"
								onClick={() => {
									onSave(captured);
									close();
								}}
								className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
							>
								Use photo
							</button>
						</>
					) : (
						<button
							type="button"
							onClick={takePhoto}
							className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
						>
							<Camera size={16} /> Take photo
						</button>
					)}
				</div>

				{currentPhoto && !captured && !denied && (
					<button
						type="button"
						onClick={() => {
							onSave(null);
							close();
						}}
						className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700"
					>
						<Trash2 size={13} /> Remove photo
					</button>
				)}
			</div>
		</div>
	);
}
