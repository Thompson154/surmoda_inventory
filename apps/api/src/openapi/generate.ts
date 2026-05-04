// CLI script: generates docs/api/openapi.yaml from registered Zod schemas.
// Run via: npm run openapi (from apps/api)
// WHY: keeps spec in sync with code; generated file is checked in for team + Swagger UI

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stringify } from 'yaml';
import { buildOpenApiDocument } from './builder';

async function main() {
  const doc = buildOpenApiDocument();
  const yaml = stringify(doc);
  const outDir = resolve(process.cwd(), '..', '..', 'docs', 'api');
  const outFile = resolve(outDir, 'openapi.yaml');
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, yaml, 'utf-8');
  console.log(`OpenAPI spec written to ${outFile}`);
}

main().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
