import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks";
import { trackPageView } from "../../lib/mixpanel";

/**
 * Tracks Page View events on route changes for Mixpanel
 */
export function RouteObserver() {
	const location = useLocation();
	const { user } = useAuth();

	useEffect(() => {
		trackPageView({
			page_url: window.location.href,
			page_title: document.title,
			user_id: user?.uid,
		});
	}, [location.pathname, location.search, user?.uid]);

	return null;
}
