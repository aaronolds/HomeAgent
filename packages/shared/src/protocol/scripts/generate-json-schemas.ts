import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateJsonSchemas } from "../json-schema.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "../../..");
const outDir = resolve(packageRoot, "src/protocol/generated");

mkdirSync(outDir, { recursive: true });

const collection = generateJsonSchemas();

// Write individual schema files
for (const [key, schema] of Object.entries(collection.schemas)) {
	const filename = `${key}.v${collection.version}.json`;
	const filepath = resolve(outDir, filename);
	writeFileSync(filepath, `${JSON.stringify(schema, null, "\t")}\n`);
}

// Write combined schema file
const combinedPath = resolve(outDir, `protocol.v${collection.version}.json`);
writeFileSync(combinedPath, `${JSON.stringify(collection, null, "\t")}\n`);

console.log(
	`Generated ${Object.keys(collection.schemas).length} JSON Schema files in ${outDir}`,
);
