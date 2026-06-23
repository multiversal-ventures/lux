import { useCallback, useEffect, useRef, useState } from "react";
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
 * Webcam capture modal for the loan-officer avatar. Live preview via the native
 * MediaDevices API (no third-party webcam dependency — react-webcam ships a UMD
 * bundle that breaks under a vite/ESM consumer). "Take photo" grabs the current
 * video frame, center-crops it to a {@link OUTPUT_SIZE}px square JPEG, then lets
 * the operator Retake or save with "Use photo". When a photo is already in use, a
 * "Remove photo" action clears it (saves `null`).
 *
 * The camera stream is started while the dialog shows a live preview and torn
 * down on capture, close, or unmount (tracks stopped — the camera light goes off).
 * Permission denial flips to an inline message instead of a blank preview.
 */
export function WebcamCaptureModal({ open, currentPhoto, onSave, onClose }: WebcamCaptureModalProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const [captured, setCaptured] = useState<string | null>(null);
	const [denied, setDenied] = useState(false);

	const stopStream = useCallback(() => {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
	}, []);

	// Run the camera only while the live preview is showing (open, not captured,
	// not denied). Re-runs on Retake (captured → null) to restart the stream.
	useEffect(() => {
		if (!open || captured || denied) return;
		let cancelled = false;
		navigator.mediaDevices
			?.getUserMedia({ video: { facingMode: "user" }, audio: false })
			.then((stream) => {
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				streamRef.current = stream;
				if (videoRef.current) {
					videoRef.current.srcObject = stream;
					void videoRef.current.play().catch(() => {});
				}
			})
			.catch(() => {
				if (!cancelled) setDenied(true);
			});
		return () => {
			cancelled = true;
			stopStream();
		};
	}, [open, captured, denied, stopStream]);

	const takePhoto = useCallback(() => {
		const video = videoRef.current;
		const vw = video?.videoWidth ?? 0;
		const vh = video?.videoHeight ?? 0;
		if (!video || !vw || !vh) return;
		// Center-crop the (arbitrary aspect) frame to a square, downscale to
		// OUTPUT_SIZE ("cover" — face fills the circle without distortion).
		const side = Math.min(vw, vh);
		const sx = (vw - side) / 2;
		const sy = (vh - side) / 2;
		const canvas = document.createElement("canvas");
		canvas.width = OUTPUT_SIZE;
		canvas.height = OUTPUT_SIZE;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.drawImage(video, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
		setCaptured(canvas.toDataURL("image/jpeg", 0.8));
	}, []);

	function reset() {
		setCaptured(null);
		setDenied(false);
	}

	function close() {
		stopStream();
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
						// Mirror the live preview (natural selfie); the saved frame is un-mirrored.
						<video
							ref={videoRef}
							autoPlay
							playsInline
							muted
							className="h-full w-full object-cover -scale-x-100"
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
