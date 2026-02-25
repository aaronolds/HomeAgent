import { createHmac, timingSafeEqual } from "node:crypto";

export function computeHmac(
	deviceId: string,
	nonce: string,
	timestamp: number,
	sharedSecret: string,
): string {
	const payload = `${deviceId}:${nonce}:${timestamp}`;
	return createHmac("sha256", sharedSecret).update(payload).digest("hex");
}

export function verifyHmac(
	signature: string,
	deviceId: string,
	nonce: string,
	timestamp: number,
	sharedSecret: string,
): boolean {
	const expected = computeHmac(deviceId, nonce, timestamp, sharedSecret);
	const providedBuffer = Buffer.from(signature, "hex");
	const expectedBuffer = Buffer.from(expected, "hex");

	if (providedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function validateTimestamp(timestamp: number, skewMs: number): boolean {
	return Math.abs(Date.now() - timestamp) <= skewMs;
}
