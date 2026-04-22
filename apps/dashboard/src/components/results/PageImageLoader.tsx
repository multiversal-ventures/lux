import { memo, useCallback, useEffect, useRef, useState } from "react";

interface PageImageLoaderProps {
	src: string;
	alt: string;
	pageNumber: number;
	className?: string;
	onLoad?: () => void;
	onError?: () => void;
	/** Optional array of adjacent page URLs to preload */
	preloadUrls?: string[];
}

// Simple in-memory image cache to prevent re-fetching
const imageCache = new Map<string, "loading" | "loaded" | "error">();
const preloadedImages = new Map<string, HTMLImageElement>();

/**
 * Preload an image URL in the background
 */
function preloadImage(url: string): void {
	if (preloadedImages.has(url) || imageCache.get(url) === "loaded") {
		return;
	}

	const img = new Image();
	img.src = url;
	preloadedImages.set(url, img);

	img.onload = () => {
		imageCache.set(url, "loaded");
	};
	img.onerror = () => {
		preloadedImages.delete(url);
	};
}

/**
 * PageImageLoader - Enhanced image loader with skeleton, caching, and preloading.
 *
 * Features:
 * - Animated skeleton placeholder while loading
 * - In-memory caching to avoid re-fetches
 * - Adjacent page preloading
 * - Native lazy loading support
 * - Progressive loading with blur-up effect
 * - Better error states with retry
 */
export const PageImageLoader = memo(function PageImageLoader({
	src,
	alt,
	pageNumber,
	className = "",
	onLoad,
	onError,
	preloadUrls = [],
}: PageImageLoaderProps) {
	const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(() => {
		// Check cache first
		const cached = imageCache.get(src);
		return cached === "loaded" ? "loaded" : "loading";
	});
	const [retryCount, setRetryCount] = useState(0);
	const [showImage, setShowImage] = useState(loadState === "loaded");
	const imgRef = useRef<HTMLImageElement>(null);
	const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Store callbacks in refs to avoid dependency issues
	const onLoadRef = useRef(onLoad);
	const onErrorRef = useRef(onError);
	onLoadRef.current = onLoad;
	onErrorRef.current = onError;
	const MAX_RETRIES = 3;

	// Calculate retry delay with exponential backoff (2s, 4s, 8s)
	const getRetryDelay = (attempt: number) => Math.min(2000 * Math.pow(2, attempt), 8000);

	// Serialize preloadUrls for stable dependency comparison
	const preloadUrlsKey = preloadUrls.join(",");

	// Preload adjacent pages when this image loads
	useEffect(() => {
		if (loadState === "loaded" && preloadUrls.length > 0) {
			// Use requestIdleCallback for non-critical preloading
			const preload = () => {
				preloadUrls.forEach((url) => preloadImage(url));
			};

			if ("requestIdleCallback" in window) {
				requestIdleCallback(preload, { timeout: 2000 });
			} else {
				setTimeout(preload, 100);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loadState, preloadUrlsKey]);

	// Handle image load
	const handleLoad = useCallback(() => {
		imageCache.set(src, "loaded");
		setLoadState("loaded");
		// Small delay before showing to allow transition
		requestAnimationFrame(() => {
			setShowImage(true);
		});
		onLoad?.();
	}, [src, onLoad]);

	// Handle image error with retry logic
	const handleError = useCallback(() => {
		if (retryCount < MAX_RETRIES) {
			const delay = getRetryDelay(retryCount);
			imageCache.set(src, "loading");

			retryTimeoutRef.current = setTimeout(() => {
				setRetryCount((prev) => prev + 1);
				// Force re-fetch by updating src
				if (imgRef.current) {
					const newSrc = `${src}${src.includes("?") ? "&" : "?"}retry=${retryCount + 1}&t=${Date.now()}`;
					imgRef.current.src = newSrc;
				}
			}, delay);
		} else {
			imageCache.set(src, "error");
			setLoadState("error");
			onError?.();
		}
	}, [src, retryCount, onError]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
			}
		};
	}, []);

	// Reset state if src changes
	// Also clears error cache entries for the same base URL to allow retry with new auth token
	useEffect(() => {
		const cached = imageCache.get(src);
		if (cached === "loaded") {
			setLoadState("loaded");
			setShowImage(true);
			// Call onLoad for cached images using ref to avoid dependency issues
			onLoadRef.current?.();
		} else {
			// Clear any previous error state for this URL pattern (without query params)
			// This allows retry when auth token becomes available after initial failure
			const baseUrl = src.split("?")[0];
			for (const [key, value] of imageCache.entries()) {
				if (key.startsWith(baseUrl) && value === "error") {
					imageCache.delete(key);
				}
			}

			setLoadState("loading");
			setShowImage(false);
			setRetryCount(0);
			imageCache.set(src, "loading");
		}
	}, [src]);

	const handleRetry = () => {
		setLoadState("loading");
		setRetryCount(0);
		imageCache.delete(src);
		if (imgRef.current) {
			imgRef.current.src = `${src}?retry=manual&t=${Date.now()}`;
		}
	};

	return (
		<div className="relative w-full">
			{/* Skeleton placeholder - shown while loading */}
			{loadState === "loading" && (
				<div className="absolute inset-0 z-10">
					<PageSkeleton pageNumber={pageNumber} retryCount={retryCount} maxRetries={MAX_RETRIES} />
				</div>
			)}

			{/* Error state */}
			{loadState === "error" && (
				<div className="flex flex-col items-center justify-center min-h-[500px] bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700/50">
					<div className="text-center p-8">
						{/* Error icon with pulse animation */}
						<div className="relative mb-4">
							<div className="absolute inset-0 bg-red-500/20 rounded-full blur-xl animate-pulse" />
							<div className="relative w-16 h-16 mx-auto bg-gradient-to-br from-red-500/30 to-red-600/30 rounded-full flex items-center justify-center border border-red-500/30">
								<svg
									className="w-8 h-8 text-red-400"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth={1.5}
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							</div>
						</div>

						<h3 className="text-lg font-medium text-slate-200 mb-2">
							Failed to load page {pageNumber}
						</h3>
						<p className="text-sm text-slate-400 mb-4">
							The image couldn't be loaded after {MAX_RETRIES} attempts
						</p>

						<button
							onClick={handleRetry}
							className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							Try Again
						</button>
					</div>
				</div>
			)}

			{/* Actual image - hidden until loaded, then fades in */}
			<img
				ref={imgRef}
				src={src}
				alt={alt}
				loading="lazy"
				decoding="async"
				className={`w-full rounded-xl shadow-lg transition-opacity duration-300 ${
					showImage ? "opacity-100" : "opacity-0"
				} ${className}`}
				onLoad={handleLoad}
				onError={handleError}
				draggable={false}
				style={{
					// Ensure minimum height during load
					minHeight: loadState === "loading" ? "500px" : undefined,
				}}
			/>
		</div>
	);
});

/**
 * PageSkeleton - Animated skeleton placeholder for page images
 */
interface PageSkeletonProps {
	pageNumber: number;
	retryCount: number;
	maxRetries: number;
}

function PageSkeleton({ pageNumber, retryCount, maxRetries }: PageSkeletonProps) {
	return (
		<div className="min-h-[500px] bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 rounded-xl overflow-hidden border border-slate-700/30">
			{/* Animated shimmer effect */}
			<div className="absolute inset-0 animate-[shimmer-slide_2s_infinite] bg-gradient-to-r from-transparent via-slate-700/30 to-transparent" />

			{/* Content skeleton */}
			<div className="relative h-full flex flex-col">
				{/* Top section - mimics document header */}
				<div className="p-6 space-y-4">
					{/* Header line skeleton */}
					<div className="flex items-center gap-4">
						<div className="w-12 h-12 bg-slate-700/50 rounded-lg animate-pulse" />
						<div className="flex-1 space-y-2">
							<div className="h-4 bg-slate-700/50 rounded w-1/3 animate-pulse" />
							<div className="h-3 bg-slate-700/30 rounded w-1/4 animate-pulse" />
						</div>
					</div>

					{/* Content line skeletons */}
					<div className="space-y-3 pt-4">
						<div className="h-3 bg-slate-700/40 rounded w-full animate-pulse" />
						<div className="h-3 bg-slate-700/40 rounded w-5/6 animate-pulse" />
						<div className="h-3 bg-slate-700/40 rounded w-4/6 animate-pulse" />
					</div>

					{/* Table-like section */}
					<div className="grid grid-cols-2 gap-4 pt-6">
						<div className="space-y-2">
							<div className="h-3 bg-slate-700/30 rounded w-2/3 animate-pulse" />
							<div className="h-4 bg-slate-700/50 rounded w-1/2 animate-pulse" />
						</div>
						<div className="space-y-2">
							<div className="h-3 bg-slate-700/30 rounded w-2/3 animate-pulse" />
							<div className="h-4 bg-slate-700/50 rounded w-1/2 animate-pulse" />
						</div>
					</div>

					{/* More content lines */}
					<div className="space-y-3 pt-4">
						<div className="h-3 bg-slate-700/40 rounded w-full animate-pulse" />
						<div className="h-3 bg-slate-700/40 rounded w-3/4 animate-pulse" />
						<div className="h-3 bg-slate-700/40 rounded w-5/6 animate-pulse" />
						<div className="h-3 bg-slate-700/40 rounded w-2/3 animate-pulse" />
					</div>
				</div>

				{/* Center loading indicator */}
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="flex flex-col items-center gap-4">
						{/* Animated loader ring */}
						<div className="relative">
							<div className="w-16 h-16 rounded-full border-4 border-slate-700/50" />
							<div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-orange-500 animate-spin" />
							<div
								className="absolute inset-2 w-12 h-12 rounded-full border-4 border-transparent border-t-orange-400/50 animate-spin"
								style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
							/>
						</div>

						{/* Loading text */}
						<div className="text-center">
							<p className="text-sm font-medium text-slate-300">Loading page {pageNumber}</p>
							{retryCount > 0 && (
								<p className="text-xs text-slate-500 mt-1">
									Retry {retryCount}/{maxRetries}
								</p>
							)}
						</div>

						{/* Progress dots */}
						<div className="flex gap-1.5">
							{[0, 1, 2].map((i) => (
								<div
									key={i}
									className="w-2 h-2 rounded-full bg-orange-500/80 animate-bounce"
									style={{ animationDelay: `${i * 0.15}s` }}
								/>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

// Add shimmer keyframes to tailwind (or use style tag)
// This should be in your global CSS:
// @keyframes shimmer {
//   100% { transform: translateX(100%); }
// }
