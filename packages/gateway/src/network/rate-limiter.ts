/**
 * In-memory sliding-window rate limiter.
 *
 * Tracks timestamped hits per key. A hit is allowed when the number of
 * timestamps within the sliding window is below maxHits.
 */
export class SlidingWindowRateLimiter {
	private readonly windows = new Map<string, number[]>();
	private readonly windowMs: number;
	private readonly maxHits: number;
	private readonly now: () => number;

	constructor(windowMs: number, maxHits: number, now: () => number = Date.now) {
		this.windowMs = windowMs;
		this.maxHits = maxHits;
		this.now = now;
	}

	/**
	 * Record a hit for `key`. Returns `true` if the request is within
	 * the rate limit, `false` if the limit has been exceeded.
	 */
	hit(key: string): boolean {
		const currentTime = this.now();
		const cutoff = currentTime - this.windowMs;
		let timestamps = this.windows.get(key);

		if (timestamps !== undefined) {
			timestamps = timestamps.filter((t) => t > cutoff);
		} else {
			timestamps = [];
		}

		if (timestamps.length >= this.maxHits) {
			this.windows.set(key, timestamps);
			return false;
		}

		timestamps.push(currentTime);
		this.windows.set(key, timestamps);
		return true;
	}

	/**
	 * Remove all expired entries across all keys. Returns the number
	 * of keys that were fully purged.
	 */
	evict(): number {
		const currentTime = this.now();
		const cutoff = currentTime - this.windowMs;
		let purged = 0;

		for (const [key, timestamps] of this.windows) {
			const active = timestamps.filter((t) => t > cutoff);
			if (active.length === 0) {
				this.windows.delete(key);
				purged += 1;
			} else {
				this.windows.set(key, active);
			}
		}

		return purged;
	}
}
