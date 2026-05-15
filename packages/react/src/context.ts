import type { VeritasSession } from "@fenero-ai/lux-core";
import { createContext } from "react";

export const SessionContext = createContext<VeritasSession | null>(null);
