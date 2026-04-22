/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;
declare const __GIT_BRANCH__: string;
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
	readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
	readonly VITE_MIXPANEL_TOKEN?: string;
}
