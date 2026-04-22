// ui/src/components/shared/MaintenancePage.tsx
import { Settings } from "lucide-react";
import feneroLogo from "../../assets/logo-orange.svg";

export default function MaintenancePage() {
	return (
		<div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
			<div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-12 max-w-md w-full text-center">
				{/* Logo and brand */}
				<div className="flex items-center justify-center gap-3 mb-8">
					<div className="w-12 h-12 flex items-center justify-center">
						<img src={feneroLogo} alt="Fenero logo" className="w-full h-full object-contain" />
					</div>
					<span className="text-2xl font-bold text-gray-900">Fenero</span>
				</div>

				{/* Animated icon */}
				<div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6">
					<Settings className="w-8 h-8 text-orange-500 animate-pulse" />
				</div>

				{/* Heading */}
				<h1 className="text-2xl font-bold text-gray-900 mb-3">We'll Be Right Back</h1>

				{/* Subtext */}
				<p className="text-gray-600 mb-8">
					We're performing scheduled maintenance to improve your experience. Please check back
					shortly.
				</p>

				{/* Status indicator */}
				<div className="flex items-center justify-center gap-2 text-sm text-gray-500">
					<div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
					<span>Checking status automatically...</span>
				</div>
			</div>
		</div>
	);
}
