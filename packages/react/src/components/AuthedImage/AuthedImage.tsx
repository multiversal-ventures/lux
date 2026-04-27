import { useEffect, type ReactNode } from "react";
import { useAuthedBlob } from "../../hooks/useAuthedBlob.js";
import styles from "./AuthedImage.module.css";

export interface AuthedImageProps {
	url: string | null;
	alt?: string;
	className?: string;
	onLoad?: (size: { naturalWidth: number; naturalHeight: number }) => void;
	onError?: (error: Error) => void;
	fallback?: ReactNode;
}

export function AuthedImage({
	url,
	alt,
	className,
	onLoad,
	onError,
	fallback,
}: AuthedImageProps) {
	const q = useAuthedBlob(url);

	useEffect(() => {
		if (q.isError && onError) {
			const err = q.error as unknown as Error;
			onError(err instanceof Error ? err : new Error(String(err)));
		}
	}, [q.isError, q.error, onError]);

	if (!url) return null;
	if (q.isError) {
		return (
			<>{fallback ?? <span className={styles.error}>image unavailable</span>}</>
		);
	}
	if (!q.data) return null;

	return (
		<img
			src={q.data}
			alt={alt ?? ""}
			className={`${styles.root}${className ? ` ${className}` : ""}`}
			onLoad={(e) => {
				const el = e.currentTarget;
				onLoad?.({
					naturalWidth: el.naturalWidth,
					naturalHeight: el.naturalHeight,
				});
			}}
		/>
	);
}
