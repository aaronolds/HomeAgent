import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import * as selfsigned from "selfsigned";

import type { GatewayConfig } from "../config/gateway-config.js";

const CERT_DIRECTORY = "certs";
const CERT_FILE_NAME = "gateway.crt";
const KEY_FILE_NAME = "gateway.key";

export type CertificateResult = {
	cert: string;
	key: string;
	selfSigned: boolean;
};

type CertificatePaths = {
	certPath: string;
	keyPath: string;
};

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function readRequiredFile(
	filePath: string,
	label: "certificate" | "private key",
): Promise<string> {
	try {
		return await readFile(filePath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(`TLS ${label} file was not found at: ${filePath}`);
		}
		throw new Error(
			`Failed to read TLS ${label} file at ${filePath}: ${(error as Error).message}`,
		);
	}
}

function getManagedCertificatePaths(dataDir: string): CertificatePaths {
	const certDirectory = path.join(dataDir, CERT_DIRECTORY);
	return {
		certPath: path.join(certDirectory, CERT_FILE_NAME),
		keyPath: path.join(certDirectory, KEY_FILE_NAME),
	};
}

export async function loadOrGenerateCertificate(
	config: GatewayConfig,
): Promise<CertificateResult> {
	if (config.certPath !== undefined || config.keyPath !== undefined) {
		if (config.certPath === undefined || config.keyPath === undefined) {
			throw new Error(
				"Both certPath and keyPath must be provided when supplying custom TLS certificates.",
			);
		}

		const [cert, key] = await Promise.all([
			readRequiredFile(config.certPath, "certificate"),
			readRequiredFile(config.keyPath, "private key"),
		]);

		return {
			cert,
			key,
			selfSigned: false,
		};
	}

	const managedPaths = getManagedCertificatePaths(config.dataDir);
	const [certExists, keyExists] = await Promise.all([
		fileExists(managedPaths.certPath),
		fileExists(managedPaths.keyPath),
	]);

	if (certExists && keyExists) {
		const [cert, key] = await Promise.all([
			readRequiredFile(managedPaths.certPath, "certificate"),
			readRequiredFile(managedPaths.keyPath, "private key"),
		]);

		return {
			cert,
			key,
			selfSigned: true,
		};
	}

	if (certExists !== keyExists) {
		throw new Error(
			`Managed TLS certificate files are incomplete in ${path.dirname(managedPaths.certPath)}. Remove incomplete files or provide both certPath and keyPath.`,
		);
	}

	const generated = selfsigned.generate(
		[{ name: "commonName", value: "homeagent-gateway" }],
		{
			days: 365,
			keySize: 2048,
			algorithm: "sha256",
			extensions: [
				{
					name: "subjectAltName",
					altNames: [
						{ type: 2, value: "localhost" },
						{ type: 7, ip: "127.0.0.1" },
						...(config.host !== undefined
							? [{ type: 2 as const, value: config.host }]
							: []),
					],
				},
			],
		},
	);

	await mkdir(path.dirname(managedPaths.certPath), { recursive: true });
	await Promise.all([
		writeFile(managedPaths.certPath, generated.cert, "utf8"),
		writeFile(managedPaths.keyPath, generated.private, "utf8"),
	]);

	return {
		cert: generated.cert,
		key: generated.private,
		selfSigned: true,
	};
}
