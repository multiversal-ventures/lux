import { useCallback, useEffect, useState } from "react";
import {
	getAuth,
	isSignInWithEmailLink,
	sendSignInLinkToEmail,
	signInWithEmailLink,
} from "firebase/auth";
import { useAuth } from "../hooks/useAuth";

async function processMagicLink(
	onError: (msg: string) => void,
	onDone: () => void,
) {
	const auth = getAuth();
	if (!isSignInWithEmailLink(auth, window.location.href)) {
		onDone();
		return;
	}

	const savedEmail = localStorage.getItem("emailForSignIn");
	if (!savedEmail) {
		onDone();
		return;
	}

	try {
		await signInWithEmailLink(auth, savedEmail, window.location.href);
		localStorage.removeItem("emailForSignIn");
		window.history.replaceState({}, document.title, "/login");
		// onDone() intentionally omitted: after sign-in, onAuthStateChanged fires and PublicRoute
		// redirects. Keeping processingMagicLink=true until redirect prevents a form flash.
	} catch {
		onError("Invalid or expired magic link. Please try again.");
		onDone();
	}
}

async function sendMagicLink(email: string): Promise<void> {
	const auth = getAuth();
	await sendSignInLinkToEmail(auth, email, {
		url: window.location.origin + "/login",
		handleCodeInApp: true,
	});
	localStorage.setItem("emailForSignIn", email);
}

// ---------------------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------------------

interface EmailSentViewProps {
	email: string;
	onRetry: () => void;
}

function EmailSentView({ email, onRetry }: EmailSentViewProps) {
	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50">
			<div className="max-w-md w-full p-8">
				<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm text-center">
					<h2 className="text-2xl font-bold text-slate-900 mb-4">Check your email!</h2>
					<p className="text-slate-600 mb-8">
						We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
					</p>
					<button
						type="button"
						onClick={onRetry}
						className="text-cta hover:text-cta-hover font-medium cursor-pointer"
					>
						Try again
					</button>
				</div>
			</div>
		</div>
	);
}

interface SignInFormProps {
	/** Pre-filled error from magic-link processing (e.g. expired link). */
	initialError?: string;
	onEmailSent: (email: string) => void;
}

function SignInForm({ initialError = "", onEmailSent }: SignInFormProps) {
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(initialError);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setError("");
			if (!email) {
				setError("Please enter your email address");
				return;
			}
			setIsLoading(true);
			try {
				await sendMagicLink(email);
				onEmailSent(email);
			} catch {
				setError("Failed to send magic link. Please try again.");
			} finally {
				setIsLoading(false);
			}
		},
		[email, onEmailSent],
	);

	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50">
			<div className="max-w-md w-full p-8">
				<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
					<h1 className="text-2xl font-bold text-slate-900 mb-2">Dashboard</h1>
					<p className="text-slate-600 mb-8">Sign in to access loan officer tools.</p>

					{error && (
						<div className="mb-4 p-3 bg-error-light border border-error text-red-700 rounded-lg text-sm">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit}>
						<label
							htmlFor="email"
							className="block text-sm font-medium text-slate-700 mb-2"
						>
							Email
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none mb-6"
							placeholder="you@example.com"
							disabled={isLoading}
						/>
						<button
							type="submit"
							disabled={isLoading}
							className="w-full bg-cta hover:bg-cta-hover text-white font-semibold py-3 px-4 rounded-full transition-colors cursor-pointer disabled:opacity-50"
						>
							{isLoading ? "Sending..." : "Sign In with Magic Link"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function LoginPage() {
	const { loading } = useAuth();
	const [sentEmail, setSentEmail] = useState("");
	const [processingMagicLink, setProcessingMagicLink] = useState(false);
	const [magicLinkError, setMagicLinkError] = useState("");

	useEffect(() => {
		if (!loading) {
			setProcessingMagicLink(true);
			processMagicLink(
				(msg) => setMagicLinkError(msg),
				() => setProcessingMagicLink(false),
			);
		}
	}, [loading]);

	if (loading || processingMagicLink) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="text-center">
					<div className="spinner mx-auto mb-4" />
					<p className="text-slate-600">
						{processingMagicLink ? "Signing you in..." : "Loading..."}
					</p>
				</div>
			</div>
		);
	}

	if (sentEmail) {
		return (
			<EmailSentView
				email={sentEmail}
				onRetry={() => setSentEmail("")}
			/>
		);
	}

	return (
		<SignInForm
			initialError={magicLinkError}
			onEmailSent={(em) => setSentEmail(em)}
		/>
	);
}
