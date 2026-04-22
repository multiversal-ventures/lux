import { createFirebaseAuthProvider, initLux } from "@fenero/lux-core";
import { type FirebaseOptions, initializeApp } from "firebase/app";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { initAnalytics, setAnalyticsUserId } from "./lib/analytics";
import { getGunnrApiBaseUrl } from "./lib/api";
import { getFirebaseAuth, waitForAuth } from "./lib/firebase";
import { identifyMixpanel, initMixpanel, resetMixpanel, trackError } from "./lib/mixpanel";

const firebaseConfig: FirebaseOptions = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
if (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
	firebaseConfig.measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
}

initializeApp(firebaseConfig);

initAnalytics();
initMixpanel();

initLux({
	baseUrl: getGunnrApiBaseUrl(),
	auth: createFirebaseAuthProvider(() => getFirebaseAuth()),
	hooks: {
		onApiError: (info) => {
			trackError({
				error_type: info.error_type,
				error_message: info.error_message,
				error_code: info.error_code,
				page_url: info.page_url,
				user_id: getFirebaseAuth().currentUser?.uid,
			});
		},
	},
});

waitForAuth().then((user) => {
	if (user) {
		setAnalyticsUserId(user.uid);
		identifyMixpanel(user.uid, {
			$email: user.email ?? "",
			$name: user.displayName ?? "",
		});
	} else {
		resetMixpanel();
	}

	createRoot(document.getElementById("root")!).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
