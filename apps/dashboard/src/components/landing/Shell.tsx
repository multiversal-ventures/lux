import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks";
import feneroLogo from "../../assets/logo-orange.svg";

interface ShellProps {
	children: React.ReactNode;
	showFooter?: boolean;
	variant?: "landing" | "app";
}

function Shell({ children, showFooter = false, variant = "landing" }: ShellProps) {
	const { user, signOut, loading } = useAuth();
	const [showUserMenu, setShowUserMenu] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	const handleLogout = async () => {
		try {
			await signOut();
			setShowUserMenu(false);
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	// Close menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setShowUserMenu(false);
			}
		};

		if (showUserMenu) {
			document.addEventListener("mousedown", handleClickOutside);
		}

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [showUserMenu]);

	return (
		<div
			style={{ minHeight: "100vh" }}
			className={`flex flex-col ${variant === "landing" ? "bg-[#E2E8F0]" : "white"}`}
		>
			{/* Header - Different variants for landing vs app */}
			<header
				className={
					variant === "landing"
						? "bg-white/80 backdrop-blur-sm border-b border-gray-200/50"
						: "bg-white shadow-sm border-b border-gray-200"
				}
			>
				<div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between items-center h-16">
						{/* Left side - Logo */}
						<div className="flex items-center space-x-6">
							<Link to="/" className="flex items-center space-x-2">
								<img src={feneroLogo} alt="Fenero logo" className="h-8" />
								<span className="text-xl font-bold text-gray-900">Fenero</span>
							</Link>
						</div>
						{/* Right side - Different for landing vs app */}
						{variant === "landing" ? (
							// Landing page header - Sign in/Sign up buttons
							<div className="flex items-center space-x-4">
								{user || loading ? (
									<>
										<span className="text-sm text-gray-600">
											{user?.email || user?.displayName || ""}
										</span>
										{!loading && (
											<button
												onClick={handleLogout}
												className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded text-sm font-medium transition-colors"
											>
												Log Out
											</button>
										)}
									</>
								) : (
									<Link to="/login" className="text-gray-700 hover:text-gray-900 font-medium">
										Sign In
									</Link>
								)}
							</div>
						) : (
							// App header - User Profile with logout button
							<div className="flex items-center space-x-4">
								<div className="relative" ref={menuRef}>
									<div
										className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 rounded-lg p-2"
										onClick={() => setShowUserMenu(!showUserMenu)}
									>
										<div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
											<span className="text-sm font-medium text-white">
												{user?.email?.charAt(0).toUpperCase() || "U"}
											</span>
										</div>
										<div className="text-left">
											<div className="text-sm font-semibold text-gray-900">
												{user?.email?.split("@")[0] || "User"}
											</div>
											<div className="text-xs text-gray-500">Loan Officer</div>
										</div>
										<svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
											<path
												fillRule="evenodd"
												d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
												clipRule="evenodd"
											/>
										</svg>
									</div>

									{/* User dropdown menu */}
									{showUserMenu && (
										<div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-200 w-fit">
											<div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
												<div className="font-medium">{user?.email}</div>
												<div className="text-xs text-gray-500">Loan Officer</div>
											</div>
											<button
												onClick={handleLogout}
												className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
											>
												Sign out
											</button>
										</div>
									)}
								</div>

								{/* Logout Button */}
								<button
									onClick={handleLogout}
									className="text-gray-700 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
								>
									Log Out
								</button>
							</div>
						)}
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main style={{ flex: "1", display: "flex", flexDirection: "column", minHeight: 0 }}>
				{children}
			</main>

			{/* Footer - Optional */}
			{showFooter && (
				<footer className="bg-gray-900 text-white py-12">
					<div className="container mx-auto px-6">
						<div className="flex flex-col md:flex-row items-center justify-between gap-6">
							<div className="flex items-center gap-3">
								<img src={feneroLogo} alt="Fenero" className="h-6 brightness-0 invert" />
								<span className="text-xl font-bold">Fenero</span>
							</div>

							<div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm text-white">
								<span>&copy; {new Date().getFullYear()} Fenero.ai</span>
								<span className="hidden md:inline">|</span>
								<a
									href="https://fenero.ai/privacy"
									target="_blank"
									rel="noopener noreferrer"
									className="text-white hover:text-orange-500 transition-colors font-medium"
								>
									Privacy Policy
								</a>
								<span className="hidden md:inline">|</span>
								<a
									href="https://fenero.ai/terms"
									target="_blank"
									rel="noopener noreferrer"
									className="text-white hover:text-orange-500 transition-colors font-medium"
								>
									Terms & Conditions
								</a>
								<span className="hidden md:inline">|</span>
								<span>
									Research powered by{" "}
									<a
										href="https://hammer.ai"
										target="_blank"
										rel="noopener noreferrer"
										className="text-orange-500 hover:text-orange-400 transition-colors font-semibold"
									>
										Hammer Labs
									</a>
								</span>
								<a
									href="https://www.linkedin.com/company/fenero-ai/about/"
									target="_blank"
									rel="noopener noreferrer"
									className="text-white hover:text-orange-500 transition-colors"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="20"
										height="20"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
									>
										<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
										<rect x="2" y="9" width="4" height="12"></rect>
										<circle cx="4" cy="4" r="2"></circle>
									</svg>
								</a>
							</div>
						</div>
					</div>
				</footer>
			)}
		</div>
	);
}

export default Shell;
