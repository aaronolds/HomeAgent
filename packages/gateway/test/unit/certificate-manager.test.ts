import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createDefaultConfig } from "../../src/config/gateway-config.js";
import { loadOrGenerateCertificate } from "../../src/tls/certificate-manager.js";

describe("certificate-manager", () => {
	const tempDirs: string[] = [];

	afterEach(async () => {
		await Promise.all(
			tempDirs
				.splice(0, tempDirs.length)
				.map((dir) => rm(dir, { recursive: true, force: true })),
		);
	});

	async function createTempDir(): Promise<string> {
		const dir = await mkdtemp(path.join(tmpdir(), "homeagent-certs-"));
		tempDirs.push(dir);
		return dir;
	}

	it("generates a self-signed cert and key files", async () => {
		const dataDir = await createTempDir();
		const config = { ...createDefaultConfig(), dataDir };

		const result = await loadOrGenerateCertificate(config);
		const certPath = path.join(dataDir, "certs", "gateway.crt");
		const keyPath = path.join(dataDir, "certs", "gateway.key");

		expect(result.selfSigned).toBe(true);
		expect(result.cert.length).toBeGreaterThan(0);
		expect(result.key.length).toBeGreaterThan(0);
		expect(await readFile(certPath, "utf8")).toBe(result.cert);
		expect(await readFile(keyPath, "utf8")).toBe(result.key);
	});

	it("loads existing self-signed cert and key from disk", async () => {
		const dataDir = await createTempDir();
		const config = { ...createDefaultConfig(), dataDir };

		const first = await loadOrGenerateCertificate(config);
		const second = await loadOrGenerateCertificate(config);

		expect(second.selfSigned).toBe(true);
		expect(second.cert).toBe(first.cert);
		expect(second.key).toBe(first.key);
	});

	it("loads user-provided cert and key from custom paths", async () => {
		const dataDir = await createTempDir();
		const customDir = await createTempDir();
		const certPath = path.join(customDir, "custom.crt");
		const keyPath = path.join(customDir, "custom.key");

		await writeFile(certPath, "custom-cert", "utf8");
		await writeFile(keyPath, "custom-key", "utf8");

		const result = await loadOrGenerateCertificate({
			...createDefaultConfig(),
			dataDir,
			certPath,
			keyPath,
		});

		expect(result).toEqual({
			cert: "custom-cert",
			key: "custom-key",
			selfSigned: false,
		});
	});

	it("throws when cert path does not exist", async () => {
		const dataDir = await createTempDir();
		const certPath = path.join(dataDir, "missing.crt");
		const keyPath = path.join(dataDir, "present.key");
		await mkdir(path.dirname(keyPath), { recursive: true });
		await writeFile(keyPath, "present-key", "utf8");

		await expect(
			loadOrGenerateCertificate({
				...createDefaultConfig(),
				dataDir,
				certPath,
				keyPath,
			}),
		).rejects.toThrowError(
			`TLS certificate file was not found at: ${certPath}`,
		);
	});

	it("throws when certPath and keyPath are not both provided", async () => {
		const dataDir = await createTempDir();

		await expect(
			loadOrGenerateCertificate({
				...createDefaultConfig(),
				dataDir,
				certPath: path.join(dataDir, "custom.crt"),
			}),
		).rejects.toThrowError(
			"Both certPath and keyPath must be provided when supplying custom TLS certificates.",
		);

		await expect(
			loadOrGenerateCertificate({
				...createDefaultConfig(),
				dataDir,
				keyPath: path.join(dataDir, "custom.key"),
			}),
		).rejects.toThrowError(
			"Both certPath and keyPath must be provided when supplying custom TLS certificates.",
		);
	});
});
