import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ROLES, type Role } from "@homeagent/shared";

import type { DeviceRecord } from "./types.js";

type FileSystem = Pick<
	typeof import("node:fs/promises"),
	"mkdir" | "readFile" | "writeFile"
>;

type ErrnoException = Error & {
	code?: string;
};

type PersistedDeviceRecord = Omit<DeviceRecord, "role"> & {
	role?: unknown;
};

const DEFAULT_ROLE: Role = "client";

function normalizeRole(value: unknown): Role {
	if (typeof value === "string" && ROLES.includes(value as Role)) {
		return value as Role;
	}

	return DEFAULT_ROLE;
}

export class DeviceRegistry {
	private readonly devices = new Map<string, DeviceRecord>();
	private readonly devicesPath: string;
	private isLoaded = false;
	private readonly fs: FileSystem;
	private readonly now: () => number;

	public constructor(
		dataDir: string,
		fs: FileSystem = { mkdir, readFile, writeFile },
		now: () => number = Date.now,
	) {
		this.devicesPath = join(dataDir, "devices.json");
		this.fs = fs;
		this.now = now;
	}

	public async load(): Promise<void> {
		if (this.isLoaded) {
			return;
		}

		await this.fs.mkdir(dirname(this.devicesPath), { recursive: true });

		try {
			const raw = await this.fs.readFile(this.devicesPath, "utf8");
			const parsed = JSON.parse(raw) as PersistedDeviceRecord[];

			this.devices.clear();
			for (const record of parsed) {
				this.devices.set(record.deviceId, {
					...record,
					role: normalizeRole(record.role),
				});
			}
		} catch (error: unknown) {
			const errnoError = error as ErrnoException;
			if (errnoError.code !== "ENOENT") {
				throw error;
			}
			this.devices.clear();
			await this.save();
		}

		this.isLoaded = true;
	}

	public async save(): Promise<void> {
		await this.fs.mkdir(dirname(this.devicesPath), { recursive: true });
		const records = Array.from(this.devices.values());
		await this.fs.writeFile(
			this.devicesPath,
			`${JSON.stringify(records, null, "\t")}\n`,
			"utf8",
		);
	}

	public async getDevice(deviceId: string): Promise<DeviceRecord | undefined> {
		await this.load();
		return this.devices.get(deviceId);
	}

	public async isApproved(deviceId: string): Promise<boolean> {
		const device = await this.getDevice(deviceId);
		return device?.approved === true;
	}

	public async getSharedSecret(deviceId: string): Promise<string | undefined> {
		const device = await this.getDevice(deviceId);
		return device?.sharedSecret;
	}

	public async registerDevice(
		record: Omit<DeviceRecord, "createdAt" | "updatedAt">,
	): Promise<void> {
		await this.load();

		const existing = this.devices.get(record.deviceId);
		const timestamp = this.now();
		const nextRecord: DeviceRecord = {
			...record,
			createdAt: existing?.createdAt ?? timestamp,
			updatedAt: timestamp,
		};

		this.devices.set(record.deviceId, nextRecord);
		await this.save();
	}

	public async approveDevice(deviceId: string): Promise<boolean> {
		await this.load();

		const existing = this.devices.get(deviceId);
		if (existing === undefined) {
			return false;
		}

		this.devices.set(deviceId, {
			...existing,
			approved: true,
			updatedAt: this.now(),
		});

		await this.save();
		return true;
	}

	public async revokeDevice(
		deviceId: string,
		_reason?: string,
	): Promise<boolean> {
		await this.load();

		const existing = this.devices.get(deviceId);
		if (existing === undefined) {
			return false;
		}

		const timestamp = this.now();

		this.devices.set(deviceId, {
			...existing,
			revoked: true,
			revokedAt: timestamp,
			updatedAt: timestamp,
		});

		await this.save();
		return true;
	}
}
