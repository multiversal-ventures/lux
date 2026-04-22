import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { VersionBadge } from "./VersionBadge";
import { TenantRestrictionPopup } from "../shared/TenantRestrictionPopup";

export function Layout() {
	return (
		<div className="h-screen flex flex-col bg-slate-200">
			<Header />
			<main className="flex-1 overflow-hidden">
				<Outlet />
			</main>
			<VersionBadge />
			{/* Global popups */}
			<TenantRestrictionPopup />
		</div>
	);
}
