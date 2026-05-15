import type { VeritasSession } from "@multiversal-ventures/lux-core";
import { createContext } from "react";

export const SessionContext = createContext<VeritasSession | null>(null);
