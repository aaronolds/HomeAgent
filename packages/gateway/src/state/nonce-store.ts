type Clock = () => number;

export class NonceStore {
	private readonly nonces = new Map<string, number>();
	private readonly windowMs: number;
	private readonly now: Clock;

	public constructor(windowMs: number, now: Clock = Date.now) {
		this.windowMs = windowMs;
		this.now = now;
	}

	public checkAndMark(nonce: string, deviceId: string): boolean {
		this.evict();

		const key = `${deviceId}:${nonce}`;
		if (this.nonces.has(key)) {
			return false;
		}

		this.nonces.set(key, this.now());
		return true;
	}

	public evict(): number {
		const cutoff = this.now() - this.windowMs;
		let evicted = 0;

		for (const [key, timestamp] of this.nonces.entries()) {
			if (timestamp < cutoff) {
				this.nonces.delete(key);
				evicted += 1;
			}
		}

		return evicted;
	}
}
