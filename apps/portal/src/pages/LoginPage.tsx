import { useState, useEffect } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import {
	getAuth,
	sendSignInLinkToEmail,
	isSignInWithEmailLink,
	signInWithEmailLink,
} from "firebase/auth";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
	const { user, loading } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [emailSent, setEmailSent] = useState(false);
	const [error, setError] = useState("");
	const [processingMagicLink, setProcessingMagicLink] = useState(() => {
		try {
			return isSignInWithEmailLink(getAuth(), window.location.href);
		} catch {
			return false;
		}
	});

	useEffect(() => {
		if (user && !loading) {
			const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/app";
			navigate(from, { replace: true });
		}
	}, [user, loading, navigate, location]);

	useEffect(() => {
		const checkMagicLink = async () => {
			const auth = getAuth();
			if (!isSignInWithEmailLink(auth, window.location.href)) return;

			setProcessingMagicLink(true);
			const savedEmail = localStorage.getItem("emailForSignIn");
			if (!savedEmail) {
				setProcessingMagicLink(false);
				return;
			}

			try {
				await signInWithEmailLink(auth, savedEmail, window.location.href);
				localStorage.removeItem("emailForSignIn");
				window.history.replaceState({}, document.title, "/login");
			} catch {
				setError("Invalid or expired magic link. Please try again.");
				setProcessingMagicLink(false);
			}
		};

		if (!loading && !user) {
			checkMagicLink();
		}
	}, [loading, user]);

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

	if (user) {
		const from = (location.state as { from?: { pathname: string } })?.from?.pathname || "/app";
		return <Navigate to={from} replace />;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!email) {
			setError("Please enter your email address");
			return;
		}

		setIsLoading(true);
		try {
			const auth = getAuth();
			await sendSignInLinkToEmail(auth, email, {
				url: window.location.origin + "/login",
				handleCodeInApp: true,
			});
			localStorage.setItem("emailForSignIn", email);
			setEmailSent(true);
		} catch {
			setError("Failed to send magic link. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	if (emailSent) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-slate-50">
				<div className="max-w-md w-full p-8">
					<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm text-center">
						<h2 className="text-2xl font-bold text-slate-900 mb-4">Check your email!</h2>
						<p className="text-slate-600 mb-8">
							We sent a magic link to <strong>{email}</strong>. Click the link to sign in.
						</p>
						<button
							onClick={() => setEmailSent(false)}
							className="text-cta hover:text-cta-hover font-medium cursor-pointer"
						>
							Try again
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-slate-50">
			<div className="max-w-md w-full p-8">
				<div className="bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
					<h1 className="text-2xl font-bold text-slate-900 mb-2">Borrower Portal</h1>
					<p className="text-slate-600 mb-8">Sign in to access your loan application.</p>

					{error && (
						<div className="mb-4 p-3 bg-error-light border border-error text-red-700 rounded-lg text-sm">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit}>
						<label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
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
