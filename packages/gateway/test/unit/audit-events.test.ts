import { describe, expect, it } from "vitest";

import {
	authFailureEvent,
	authSuccessEvent,
	connectionEvent,
	deviceApprovedEvent,
	deviceRegisteredEvent,
	deviceRevokedEvent,
	execApprovalEvent,
	fileAccessViolationEvent,
	nonceReplayEvent,
	pluginDisabledEvent,
	rpcDeniedEvent,
	secretAccessedEvent,
	secretStoredEvent,
	transcriptWriteErrorEvent,
} from "../../src/audit/audit-events.js";

describe("audit-events", () => {
	describe("authFailureEvent", () => {
		it("returns correct event type and outcome", () => {
			const evt = authFailureEvent("dev-1", "bad hmac");
			expect(evt.event).toBe("auth_failure");
			expect(evt.outcome).toBe("failure");
			expect(evt.deviceId).toBe("dev-1");
			expect(evt.details).toEqual({ reason: "bad hmac" });
			expect(evt.timestamp).toBeTypeOf("number");
		});
	});

	describe("authSuccessEvent", () => {
		it("returns correct event type and outcome", () => {
			const evt = authSuccessEvent("dev-2");
			expect(evt.event).toBe("auth_success");
			expect(evt.outcome).toBe("success");
			expect(evt.deviceId).toBe("dev-2");
			expect(evt.details).toBeUndefined();
		});
	});

	describe("nonceReplayEvent", () => {
		it("returns correct event type and outcome", () => {
			const evt = nonceReplayEvent("dev-3", "abc123");
			expect(evt.event).toBe("nonce_replay");
			expect(evt.outcome).toBe("failure");
			expect(evt.deviceId).toBe("dev-3");
			expect(evt.details).toEqual({ nonce: "abc123" });
		});
	});

	describe("connectionEvent", () => {
		it("returns connected action", () => {
			const evt = connectionEvent("dev-4", "connected");
			expect(evt.event).toBe("connection");
			expect(evt.outcome).toBe("success");
			expect(evt.details).toEqual({ action: "connected" });
		});

		it("returns disconnected action", () => {
			const evt = connectionEvent("dev-4", "disconnected");
			expect(evt.details).toEqual({ action: "disconnected" });
		});
	});

	describe("deviceRegisteredEvent", () => {
		it("sets actor when provided", () => {
			const evt = deviceRegisteredEvent("dev-5", "admin-1");
			expect(evt.event).toBe("device_registered");
			expect(evt.outcome).toBe("success");
			expect(evt.deviceId).toBe("dev-5");
			expect(evt.actor).toBe("admin-1");
		});

		it("leaves actor undefined when omitted", () => {
			const evt = deviceRegisteredEvent("dev-5");
			expect(evt.actor).toBeUndefined();
		});
	});

	describe("deviceApprovedEvent", () => {
		it("returns correct fields", () => {
			const evt = deviceApprovedEvent("dev-6", "admin-2");
			expect(evt.event).toBe("device_approved");
			expect(evt.outcome).toBe("success");
			expect(evt.actor).toBe("admin-2");
		});
	});

	describe("deviceRevokedEvent", () => {
		it("returns correct fields", () => {
			const evt = deviceRevokedEvent("dev-7", "admin-3");
			expect(evt.event).toBe("device_revoked");
			expect(evt.outcome).toBe("success");
			expect(evt.actor).toBe("admin-3");
		});
	});

	describe("rpcDeniedEvent", () => {
		it("returns denied outcome with method and reason", () => {
			const evt = rpcDeniedEvent("dev-8", "device.revoke", "not admin");
			expect(evt.event).toBe("rpc_denied");
			expect(evt.outcome).toBe("denied");
			expect(evt.details).toEqual({
				method: "device.revoke",
				reason: "not admin",
			});
		});
	});

	describe("execApprovalEvent", () => {
		it("returns success when approved", () => {
			const evt = execApprovalEvent("dev-9", "req-1", true, "admin-4");
			expect(evt.event).toBe("exec_approval");
			expect(evt.outcome).toBe("success");
			expect(evt.actor).toBe("admin-4");
			expect(evt.details).toEqual({ requestId: "req-1", approved: true });
		});

		it("returns denied when not approved", () => {
			const evt = execApprovalEvent("dev-9", "req-2", false, "admin-4");
			expect(evt.outcome).toBe("denied");
			expect(evt.details).toEqual({ requestId: "req-2", approved: false });
		});
	});

	describe("pluginDisabledEvent", () => {
		it("returns correct fields without deviceId", () => {
			const evt = pluginDisabledEvent("plugin-1", "admin-5");
			expect(evt.event).toBe("plugin_disabled");
			expect(evt.outcome).toBe("success");
			expect(evt.actor).toBe("admin-5");
			expect(evt.details).toEqual({ pluginId: "plugin-1" });
			expect(evt.deviceId).toBeUndefined();
		});
	});

	describe("secretAccessedEvent", () => {
		it("returns correct fields", () => {
			const evt = secretAccessedEvent("OPENAI_KEY", "admin-6");
			expect(evt.event).toBe("secret_accessed");
			expect(evt.outcome).toBe("success");
			expect(evt.actor).toBe("admin-6");
			expect(evt.details).toEqual({ key: "OPENAI_KEY" });
		});
	});

	describe("secretStoredEvent", () => {
		it("returns correct fields", () => {
			const evt = secretStoredEvent("DB_PASSWORD", "admin-7");
			expect(evt.event).toBe("secret_stored");
			expect(evt.outcome).toBe("success");
			expect(evt.details).toEqual({ key: "DB_PASSWORD" });
		});
	});

	describe("fileAccessViolationEvent", () => {
		it("returns denied outcome", () => {
			const evt = fileAccessViolationEvent("/etc/shadow", "dev-10");
			expect(evt.event).toBe("file_access_violation");
			expect(evt.outcome).toBe("denied");
			expect(evt.deviceId).toBe("dev-10");
			expect(evt.details).toEqual({ path: "/etc/shadow" });
		});
	});

	describe("transcriptWriteErrorEvent", () => {
		it("returns failure outcome", () => {
			const evt = transcriptWriteErrorEvent("sess-1", "ENOSPC");
			expect(evt.event).toBe("transcript_write_error");
			expect(evt.outcome).toBe("failure");
			expect(evt.details).toEqual({ sessionId: "sess-1", error: "ENOSPC" });
			expect(evt.deviceId).toBeUndefined();
		});
	});
});
