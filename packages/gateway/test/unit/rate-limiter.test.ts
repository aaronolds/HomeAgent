import { describe, expect, it } from "vitest";
import { SlidingWindowRateLimiter } from "../../src/network/rate-limiter.js";

describe("SlidingWindowRateLimiter", () => {
	it("allows requests within limit", () => {
		const limiter = new SlidingWindowRateLimiter(5000, 3);
		expect(limiter.hit("key")).toBe(true);
		expect(limiter.hit("key")).toBe(true);
		expect(limiter.hit("key")).toBe(true);
	});

	it("rejects when limit exceeded", () => {
		const limiter = new SlidingWindowRateLimiter(5000, 2);
		expect(limiter.hit("key")).toBe(true);
		expect(limiter.hit("key")).toBe(true);
		expect(limiter.hit("key")).toBe(false);
	});

	it("window slides: old entries expire", () => {
		let time = 1000;
		const limiter = new SlidingWindowRateLimiter(5000, 2, () => time);

		expect(limiter.hit("key")).toBe(true); // t=1000
		time = 2000;
		expect(limiter.hit("key")).toBe(true); // t=2000
		time = 3000;
		expect(limiter.hit("key")).toBe(false); // t=3000, limit reached

		time = 7000; // first entry (t=1000) expired
		expect(limiter.hit("key")).toBe(true);
	});

	it("independent keys do not interfere", () => {
		const limiter = new SlidingWindowRateLimiter(5000, 1);
		expect(limiter.hit("a")).toBe(true);
		expect(limiter.hit("b")).toBe(true);
		expect(limiter.hit("a")).toBe(false);
		expect(limiter.hit("b")).toBe(false);
	});

	it("evict cleans expired entries", () => {
		let time = 1000;
		const limiter = new SlidingWindowRateLimiter(5000, 2, () => time);

		limiter.hit("a"); // t=1000
		time = 3000;
		limiter.hit("b"); // t=3000

		time = 7000; // cutoff=2000: "a" (t=1000) expired, "b" (t=3000) still active
		expect(limiter.evict()).toBe(1);

		time = 9000; // cutoff=4000: "b" (t=3000) now expired
		expect(limiter.evict()).toBe(1);
	});

	it("evict returns zero when nothing expired", () => {
		const time = 1000;
		const limiter = new SlidingWindowRateLimiter(5000, 2, () => time);

		limiter.hit("key"); // t=1000
		expect(limiter.evict()).toBe(0);
	});
});
