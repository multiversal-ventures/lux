// ui/src/contexts/HealthContext.tsx
import {
	createContext,
	useContext,
	useState,
	useEffect,
	useCallback,
	useRef,
	type ReactNode,
} from "react";
import MaintenancePage from "../components/shared/MaintenancePage";
import { resolveApiUrl } from "../lib/api";
import { isDevUiOnlyBypass } from "../lib/devUiOnly";

interface HealthState {
	isMaintenanceMode: boolean;
	services: Record<string, boolean>;
	lastChecked: string | null;
	isLoading: boolean;
}

interface HealthContextValue extends HealthState {
	checkHealth: () => Promise<void>;
}

const HealthContext = createContext<HealthContextValue | null>(null);

const POLL_INTERVAL = 30000; // 30 seconds
const FAILURE_THRESHOLD = 2; // consecutive failures before showing maintenance

export function HealthProvider({ children }: { children: ReactNode }) {
	const bypass = isDevUiOnlyBypass();
	const failureCountRef = useRef(0);
	const [state, setState] = useState<HealthState>(() => ({
		isMaintenanceMode: false,
		services: {},
		lastChecked: bypass ? new Date().toISOString() : null,
		isLoading: !bypass,
	}));

	const checkHealth = useCallback(async () => {
		if (bypass) {
			return;
		}
		try {
			const response = await fetch(resolveApiUrl("/api/v1/health"));
			const data = await response.json();

			if (response.ok) {
				failureCountRef.current = 0;
				setState({
					isMaintenanceMode: false,
					services: data.services || {},
					lastChecked: data.checked_at || new Date().toISOString(),
					isLoading: false,
				});
			} else {
				failureCountRef.current += 1;
				const newCount = failureCountRef.current;
				setState({
					isMaintenanceMode: newCount >= FAILURE_THRESHOLD,
					services: data.services || {},
					lastChecked: data.checked_at || new Date().toISOString(),
					isLoading: false,
				});
			}
		} catch {
			failureCountRef.current += 1;
			const newCount = failureCountRef.current;
			setState((s) => ({
				...s,
				isMaintenanceMode: newCount >= FAILURE_THRESHOLD,
				isLoading: false,
			}));
		}
	}, [bypass]);

	useEffect(() => {
		if (bypass) {
			return;
		}
		checkHealth();
	}, [checkHealth, bypass]);

	useEffect(() => {
		if (bypass) {
			return;
		}
		const interval = setInterval(checkHealth, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [checkHealth, bypass]);

	return (
		<HealthContext.Provider value={{ ...state, checkHealth }}>{children}</HealthContext.Provider>
	);
}

export function useHealth() {
	const context = useContext(HealthContext);
	if (!context) {
		throw new Error("useHealth must be used within a HealthProvider");
	}
	return context;
}

export function HealthGate({ children }: { children: ReactNode }) {
	const bypass = isDevUiOnlyBypass();
	const { isMaintenanceMode, isLoading } = useHealth();

	if (bypass) {
		return (
			<>
				<div
					role="status"
					className="fixed top-0 left-0 right-0 z-[9999] bg-amber-300 px-2 py-1 text-center text-xs font-medium text-amber-950 shadow-sm"
				>
					VITE_DEV_UI_ONLY: no health API — remove from .env before ship
				</div>
				<div className="pt-7">{children}</div>
			</>
		);
	}

	if (isLoading) {
		return <>{children}</>;
	}

	if (isMaintenanceMode) {
		return <MaintenancePage />;
	}

	return <>{children}</>;
}
