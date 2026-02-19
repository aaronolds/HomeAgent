import { z } from "zod/v4";
import { PROTOCOL_VERSION } from "./constants.js";
import {
	EventEnvelopeSchema,
	RequestEnvelopeSchema,
	ResponseEnvelopeSchema,
} from "./envelopes.js";
import {
	ConnectOkSchema,
	ConnectSchema,
	ProtocolErrorSchema,
} from "./handshake.js";
import { MethodSchemas } from "./methods.js";

export interface JsonSchemaCollection {
	readonly version: string;
	readonly schemas: Record<string, unknown>;
}

function convert(schema: z.ZodType, name: string): unknown {
	const jsonSchema = z.toJSONSchema(schema, { target: "draft-7" });
	if (jsonSchema && typeof jsonSchema === "object") {
		return {
			...jsonSchema,
			title: name,
		};
	}
	return jsonSchema;
}

/**
 * Generate all protocol JSON Schema definitions.
 */
export function generateJsonSchemas(): JsonSchemaCollection {
	const schemas: Record<string, unknown> = {};

	// Handshake
	schemas["handshake.connect"] = convert(ConnectSchema, "Connect");
	schemas["handshake.connect_ok"] = convert(ConnectOkSchema, "ConnectOk");
	schemas["handshake.error"] = convert(ProtocolErrorSchema, "ProtocolError");

	// Envelopes
	schemas["envelope.request"] = convert(
		RequestEnvelopeSchema,
		"RequestEnvelope",
	);
	schemas["envelope.response"] = convert(
		ResponseEnvelopeSchema,
		"ResponseEnvelope",
	);
	schemas["envelope.event"] = convert(EventEnvelopeSchema, "EventEnvelope");

	// Method payloads
	for (const [method, { params, result }] of Object.entries(MethodSchemas)) {
		const safeName = method.replace(/\./g, "_");
		schemas[`method.${method}.params`] = convert(params, `${safeName}_params`);
		schemas[`method.${method}.result`] = convert(result, `${safeName}_result`);
	}

	return { version: PROTOCOL_VERSION, schemas };
}
