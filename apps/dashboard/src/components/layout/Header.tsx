import { useSession } from "@fenero/lux-react";
import { Link, useLocation, useParams } from "react-router-dom";
import logoOrange from "../../assets/logo-orange.svg";
import { useAuth, useCaseHistory } from "../../hooks";
import { getCaseDisplayName } from "../../utils/caseNameUtils";
import { EditableCaseName } from "../shared";

interface LocationState {
	caseName?: string;
	caseId?: string;
	pendingFiles?: unknown[];
}

export function Header() {
	const { user, signOut } = useAuth();
	const session = useSession();
	const { caseId: routeCaseId } = useParams<{ caseId?: string }>();
	const location = useLocation();
	const { cases, updateCaseName, addCase } = useCaseHistory();
	const storeCaseName = session.activeCaseName;

	const activeCaseId = routeCaseId;
	const stateCaseName = (location.state as LocationState | null)?.caseName;
	const stateCaseId = (location.state as LocationState | null)?.caseId;
	const useStateName = activeCaseId && stateCaseId === activeCaseId && stateCaseName;

	const currentCase = activeCaseId ? cases.find((c) => c.case_id === activeCaseId) : null;

	// Prefer store case name (set by CasePage immediately) for instant display, then location state, then case history
	const caseDisplayName = activeCaseId
		? storeCaseName || (useStateName ? stateCaseName : getCaseDisplayName(currentCase, cases))
		: null;

	const handleLogout = async () => {
		await signOut();
	};

	const handleCaseNameSave = (newName: string) => {
		if (activeCaseId) {
			if (!currentCase) {
				addCase(activeCaseId, 0);
			}
			updateCaseName(activeCaseId, newName);
			session.setActiveCaseName(newName);
		}
	};

	return (
		<header className="flex items-center justify-between px-6 h-16 bg-white border-b border-slate-200">
			<div className="flex items-center gap-2.5">
				<Link to="/" className="flex items-center gap-2.5 no-underline">
					<img src={logoOrange} alt="Quick Check" className="h-8 w-auto" />
					<span className="text-xl font-bold text-slate-900">Quick Check</span>
				</Link>
				{caseDisplayName && (
					<>
						<span className="text-slate-300 mx-1">•</span>
						<EditableCaseName
							value={caseDisplayName}
							onSave={handleCaseNameSave}
							placeholder="Untitled Case"
							className="shrink-0"
							displayClassName="text-lg font-semibold text-slate-700"
						/>
					</>
				)}
			</div>
			<div className="flex items-center gap-4">
				{user && (
					<>
						<span className="text-sm text-slate-500">{user.email}</span>
						<button
							onClick={handleLogout}
							className="text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors cursor-pointer"
						>
							Logout
						</button>
					</>
				)}
			</div>
		</header>
	);
}
