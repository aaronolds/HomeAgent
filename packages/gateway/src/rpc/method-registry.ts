import type { RpcMethod } from "@homeagent/shared";

import type { RpcHandler } from "./types.js";

export class MethodRegistry {
	private readonly handlers = new Map<string, RpcHandler>();

	public register(method: RpcMethod, handler: RpcHandler): void {
		if (this.handlers.has(method)) {
			throw new Error(`Method "${method}" is already registered`);
		}
		this.handlers.set(method, handler);
	}

	public get(method: string): RpcHandler | undefined {
		return this.handlers.get(method);
	}

	public has(method: string): boolean {
		return this.handlers.has(method);
	}

	public methods(): string[] {
		return Array.from(this.handlers.keys());
	}
}
