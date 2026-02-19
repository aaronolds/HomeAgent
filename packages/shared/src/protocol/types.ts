import { z } from "zod/v4";
import { PROTOCOL_VERSION, ROLES } from "./constants.js";

/** Non-empty string (trimmed) */
export const NonEmptyString = z.string().trim().min(1);

/** Non-empty string identifier */
export const Identifier = z.string().min(1);

/** Unix epoch timestamp in milliseconds */
export const Timestamp = z.number().int().positive();

/** Protocol version schema - currently only "1.0" */
export const ProtocolVersion = z.literal(PROTOCOL_VERSION);

/** Role enum schema */
export const RoleSchema = z.enum(ROLES);
