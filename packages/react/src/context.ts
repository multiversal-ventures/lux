import type { VeritasSession } from "@fenero/lux-core";
import type { Auth } from "firebase/auth";
import { type ReactNode, createContext } from "react";

export type FirebaseAuthGetter = () => Auth;

export const SessionContext = createContext<VeritasSession | null>(null);

export const FirebaseAuthGetterContext = createContext<FirebaseAuthGetter | null>(null);

export type SessionProviderProps = {
	children: ReactNode;
	/** Optional. Required only if consumers call {@link useAuth}. */
	firebaseAuth?: FirebaseAuthGetter;
};
