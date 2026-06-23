import {
	useMutation,
	useQuery,
	useQueryClient,
	type UseMutationResult,
	type UseQueryResult,
} from "@tanstack/react-query";
import { getDefaultClient, type components } from "@multiversal-ventures/lux-core";

export type OfficerProfile = components["schemas"]["OfficerProfile"];

const officerSettingsKey = ["officer-settings"] as const;

/** The firm's loan-officer profile (name + avatar). Drives the operator's own
 * chat-bubble avatar and the webcam capture's "current photo". */
export function useOfficerSettings(): UseQueryResult<OfficerProfile, Error> {
	return useQuery<OfficerProfile, Error>({
		queryKey: officerSettingsKey,
		queryFn: async () => getDefaultClient().getOfficerSettings(),
	});
}

/** Set (or clear, with `null`) the loan-officer avatar. On success refreshes the
 * settings query AND every portal overview so the avatar updates live across the
 * operator's open Party Hub views (the officer fields ride on the overview). */
export function useSetOfficerAvatar(): UseMutationResult<OfficerProfile, Error, string | null> {
	const qc = useQueryClient();
	return useMutation<OfficerProfile, Error, string | null>({
		mutationFn: async (avatar) => getDefaultClient().setOfficerAvatar(avatar),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: officerSettingsKey });
			// Officer name/avatar are embedded on each case's PortalOverview, so
			// invalidate the whole family to repaint open operator chats live.
			qc.invalidateQueries({ queryKey: ["portal-overview"] });
		},
	});
}
