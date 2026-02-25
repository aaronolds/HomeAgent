import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateConfigJsonSchema } from "../json-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "../..");
const outDir = resolve(packageRoot, "src/generated");

mkdirSync(outDir, { recursive: true });

const { version, schema } = generateConfigJsonSchema();

const filename = `homeagent-config.v${version}.json`;
const filepath = resolve(outDir, filename);
writeFileSync(filepath, `${JSON.stringify(schema, null, "\t")}\n`);

console.log(`Generated config JSON Schema: ${filepath}`);