// ui/src/contexts/HealthContext.tsx
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import MaintenancePage from "../components/shared/MaintenancePage";

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
	const [state, setState] = useState<HealthState>({
		isMaintenanceMode: false,
		services: {},
		lastChecked: null,
		isLoading: true,
	});
	const [failureCount, setFailureCount] = useState(0);

	const checkHealth = useCallback(async () => {
		try {
			const response = await fetch("/api/v1/health");
			const data = await response.json();

			if (response.ok) {
				// Healthy - reset failure count and clear maintenance mode
				setFailureCount(0);
				setState({
					isMaintenanceMode: false,
					services: data.services || {},
					lastChecked: data.checked_at || new Date().toISOString(),
					isLoading: false,
				});
			} else {
				// Unhealthy response (503)
				const newCount = failureCount + 1;
				setFailureCount(newCount);
				setState({
					isMaintenanceMode: newCount >= FAILURE_THRESHOLD,
					services: data.services || {},
					lastChecked: data.checked_at || new Date().toISOString(),
					isLoading: false,
				});
			}
		} catch {
			// Network error
			const newCount = failureCount + 1;
			setFailureCount(newCount);
			setState((s) => ({
				...s,
				isMaintenanceMode: newCount >= FAILURE_THRESHOLD,
				isLoading: false,
			}));
		}
	}, [failureCount]);

	// Initial check
	useEffect(() => {
		checkHealth();
	}, [checkHealth]);

	// Polling interval
	useEffect(() => {
		const interval = setInterval(checkHealth, POLL_INTERVAL);
		return () => clearInterval(interval);
	}, [checkHealth]);

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
	const { isMaintenanceMode, isLoading } = useHealth();

	// Don't show maintenance page during initial load
	if (isLoading) {
		return <>{children}</>;
	}

	if (isMaintenanceMode) {
		return <MaintenancePage />;
	}

	return <>{children}</>;
}
