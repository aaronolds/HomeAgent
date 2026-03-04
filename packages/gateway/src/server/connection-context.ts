import type { Role } from "@homeagent/shared";

export interface ConnectionContext {
	connectionId: string;
	deviceId: string;
	role: Role;
	sessionToken: string;
	connectedAt: number;
}

export class ConnectionManager {
	private readonly connections = new Map<string, ConnectionContext>();

	public add(ctx: ConnectionContext): void {
		this.connections.set(ctx.connectionId, ctx);
	}

	public get(connectionId: string): ConnectionContext | undefined {
		return this.connections.get(connectionId);
	}

	public remove(connectionId: string): void {
		this.connections.delete(connectionId);
	}

	public getByDeviceId(deviceId: string): ConnectionContext | undefined {
		for (const context of this.connections.values()) {
			if (context.deviceId === deviceId) {
				return context;
			}
		}

		return undefined;
	}

	public removeByDeviceId(deviceId: string): ConnectionContext | undefined {
		for (const [connectionId, context] of this.connections.entries()) {
			if (context.deviceId === deviceId) {
				this.connections.delete(connectionId);
				return context;
			}
		}

		return undefined;
	}
}
