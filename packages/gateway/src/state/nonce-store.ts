type Clock = () => number;

export class NonceStore {
	private readonly devices = new Map<string, Map<string, number>>();
	private readonly windowMs: number;
	private readonly now: Clock;

	public constructor(windowMs: number, now: Clock = Date.now) {
		this.windowMs = windowMs;
		this.now = now;
	}

	public checkAndMark(nonce: string, deviceId: string): boolean {
		this.evict();

		let nonces = this.devices.get(deviceId);
		if (nonces === undefined) {
			nonces = new Map<string, number>();
			this.devices.set(deviceId, nonces);
		}

		if (nonces.has(nonce)) {
			return false;
		}

		nonces.set(nonce, this.now());
		return true;
	}

	public evict(): number {
		const cutoff = this.now() - this.windowMs;
		let evicted = 0;

		for (const [deviceId, nonces] of this.devices.entries()) {
			for (const [nonce, timestamp] of nonces.entries()) {
				if (timestamp < cutoff) {
					nonces.delete(nonce);
					evicted += 1;
				}
			}
			if (nonces.size === 0) {
				this.devices.delete(deviceId);
			}
		}

		return evicted;
	}
}
