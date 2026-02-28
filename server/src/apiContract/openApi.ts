import {
  EndpointContract,
  FieldShape,
  OPENAPI_CANDIDATE_GLOBS
} from "./types";
import { normalizeApiPath } from "./path";
import * as yaml from "js-yaml";

type OpenApiDoc = {
  paths?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

type SchemaResolver = {
  resolveByRef: (ref: string) => unknown | undefined;
};

const OPENAPI_METHODS = ["get", "post", "put", "patch", "delete"] as const;
const SCHEMA_COMPOSITION_KEYS = ["allOf", "oneOf", "anyOf"] as const;

export function discoverOpenApiFiles(relativePaths: string[]): string[] {
  return relativePaths
    .filter((relativePath) => isOpenApiCandidate(relativePath))
    .sort((left, right) => left.localeCompare(right));
}

export function parseOpenApiContractsFromFiles(
  files: Array<{ relativePath: string; text: string }>
): EndpointContract[] {
  const endpoints: EndpointContract[] = [];
  for (const file of files) {
    if (!isOpenApiCandidate(file.relativePath)) {
      continue;
    }
    const parsed = tryParseOpenApiDoc(file.text);
    if (!parsed?.paths || typeof parsed.paths !== "object") {
      continue;
    }
    endpoints.push(...extractOpenApiEndpoints(parsed, file.relativePath));
  }
  return dedupeEndpoints(endpoints);
}

function isOpenApiCandidate(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  return OPENAPI_CANDIDATE_GLOBS.some((pattern) => {
    const normalized = pattern
      .replaceAll("**/", "")
      .replaceAll("*", "")
      .replaceAll(".yaml", "")
      .replaceAll(".yml", "")
      .replaceAll(".json", "");
    return lower.includes(normalized);
  });
}

function tryParseOpenApiJson(text: string): OpenApiDoc | undefined {
  try {
    return JSON.parse(text) as OpenApiDoc;
  } catch {
    return undefined;
  }
}

function tryParseOpenApiDoc(text: string): OpenApiDoc | undefined {
  return tryParseOpenApiJson(text) ?? tryParseOpenApiYaml(text);
}

function tryParseOpenApiYaml(text: string): OpenApiDoc | undefined {
  try {
    const parsed = yaml.load(text);
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return parsed as OpenApiDoc;
  } catch {
    return undefined;
  }
}

function extractOpenApiEndpoints(doc: OpenApiDoc, sourceFile: string): EndpointContract[] {
  const endpoints: EndpointContract[] = [];
  const resolver = buildSchemaResolver(doc);
  const paths = doc.paths ?? {};
  for (const [rawPath, rawOperationMap] of Object.entries(paths)) {
    if (!rawOperationMap || typeof rawOperationMap !== "object") {
      continue;
    }
    const operationMap = rawOperationMap as Record<string, unknown>;
    for (const methodKey of OPENAPI_METHODS) {
      const rawOperation = operationMap[methodKey];
      if (!rawOperation || typeof rawOperation !== "object") {
        continue;
      }
      const operation = rawOperation as Record<string, unknown>;
      endpoints.push({
        method: methodKey.toUpperCase(),
        path: normalizeApiPath(rawPath),
        sourceFile,
        requestFields: extractSchemaFields(
          extractOpenApiRequestSchema(operation),
          resolver
        ),
        responseFields: extractSchemaFields(
          extractOpenApiResponseSchema(operation),
          resolver
        )
      });
    }
  }
  return endpoints;
}

function buildSchemaResolver(doc: OpenApiDoc): SchemaResolver {
  return {
    resolveByRef: (ref: string) => resolveOpenApiRef(doc, ref)
  };
}

function resolveOpenApiRef(doc: OpenApiDoc, ref: string): unknown | undefined {
  if (!ref.startsWith("#/")) {
    return undefined;
  }
  return resolveJsonPointer(doc as unknown as Record<string, unknown>, ref.slice(2));
}

function resolveJsonPointer(
  root: Record<string, unknown>,
  pointer: string
): unknown | undefined {
  let current: unknown = root;
  for (const rawPart of pointer.split("/")) {
    const part = decodeJsonPointerToken(rawPart);
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function decodeJsonPointerToken(token: string): string {
  return token.replaceAll("~1", "/").replaceAll("~0", "~");
}

function extractOpenApiRequestSchema(operation: Record<string, unknown>): unknown {
  const requestBody = operation.requestBody;
  if (!requestBody || typeof requestBody !== "object") {
    return undefined;
  }
  return extractSchemaFromContent(
    (requestBody as { content?: Record<string, unknown> }).content
  );
}

function extractOpenApiResponseSchema(operation: Record<string, unknown>): unknown {
  const responses = operation.responses;
  if (!responses || typeof responses !== "object") {
    return undefined;
  }

  const responseMap = responses as Record<string, unknown>;
  for (const statusCode of ["200", "201", "202", "default"]) {
    const response = responseMap[statusCode];
    if (!response || typeof response !== "object") {
      continue;
    }
    const schema = extractSchemaFromContent(
      (response as { content?: Record<string, unknown> }).content
    );
    if (schema) {
      return schema;
    }
  }
  return undefined;
}

function extractSchemaFromContent(content: Record<string, unknown> | undefined): unknown {
  if (!content || typeof content !== "object") {
    return undefined;
  }
  for (const [contentType, spec] of Object.entries(content)) {
    if (!spec || typeof spec !== "object") {
      continue;
    }
    if (contentType.includes("json")) {
      return (spec as { schema?: unknown }).schema;
    }
  }
  const first = Object.values(content)[0] as { schema?: unknown } | undefined;
  return first?.schema;
}

function extractSchemaFields(
  schema: unknown,
  resolver: SchemaResolver,
  seenRefs: Set<string> = new Set<string>()
): FieldShape[] {
  const schemaObj = dereferenceSchema(schema, resolver, seenRefs);
  if (!schemaObj || typeof schemaObj !== "object") {
    return [];
  }

  const directFields = extractObjectSchemaFields(
    schemaObj as Record<string, unknown>,
    resolver,
    seenRefs
  );
  if (directFields.length > 0) {
    return directFields;
  }

  const merged: FieldShape[] = [];
  for (const key of SCHEMA_COMPOSITION_KEYS) {
    const composed = (schemaObj as Record<string, unknown>)[key];
    if (!Array.isArray(composed)) {
      continue;
    }
    for (const part of composed) {
      merged.push(...extractSchemaFields(part, resolver, new Set(seenRefs)));
    }
  }
  return dedupeFields(merged);
}

function extractObjectSchemaFields(
  schemaObj: Record<string, unknown>,
  resolver: SchemaResolver,
  seenRefs: Set<string>
): FieldShape[] {
  const properties = schemaObj.properties;
  if (!properties || typeof properties !== "object") {
    return [];
  }

  const requiredSet = new Set<string>(
    Array.isArray(schemaObj.required)
      ? schemaObj.required.filter((item): item is string => typeof item === "string")
      : []
  );

  const fields: FieldShape[] = [];
  for (const [name, rawProperty] of Object.entries(properties as Record<string, unknown>)) {
    const propertyType = inferSchemaType(
      rawProperty,
      resolver,
      new Set(seenRefs)
    );
    fields.push({ name, type: propertyType, required: requiredSet.has(name) });
  }
  return fields;
}

function inferSchemaType(
  schema: unknown,
  resolver: SchemaResolver,
  seenRefs: Set<string>
): string | undefined {
  const resolved = dereferenceSchema(schema, resolver, seenRefs);
  if (!resolved || typeof resolved !== "object") {
    return undefined;
  }
  const schemaObj = resolved as Record<string, unknown>;
  const type = schemaObj.type;
  if (typeof type === "string") {
    if (type !== "array") {
      return type;
    }
    const itemType = inferSchemaType(schemaObj.items, resolver, new Set(seenRefs));
    return itemType ? `array<${itemType}>` : "array";
  }

  if (schemaObj.properties && typeof schemaObj.properties === "object") {
    return "object";
  }
  if (schemaObj.items) {
    const itemType = inferSchemaType(schemaObj.items, resolver, new Set(seenRefs));
    return itemType ? `array<${itemType}>` : "array";
  }
  if (Array.isArray(schemaObj.enum) && schemaObj.enum.length > 0) {
    const sample = schemaObj.enum[0];
    if (typeof sample === "string") {
      return "string";
    }
    if (typeof sample === "number") {
      return "number";
    }
    if (typeof sample === "boolean") {
      return "boolean";
    }
  }

  for (const key of SCHEMA_COMPOSITION_KEYS) {
    const composed = schemaObj[key];
    if (!Array.isArray(composed)) {
      continue;
    }
    for (const part of composed) {
      const inferred = inferSchemaType(part, resolver, new Set(seenRefs));
      if (inferred) {
        return inferred;
      }
    }
  }
  return undefined;
}

function dereferenceSchema(
  schema: unknown,
  resolver: SchemaResolver,
  seenRefs: Set<string>
): unknown {
  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const ref = (schema as { $ref?: unknown }).$ref;
  if (typeof ref !== "string") {
    return schema;
  }
  if (seenRefs.has(ref)) {
    return undefined;
  }
  seenRefs.add(ref);
  const resolved = resolver.resolveByRef(ref);
  if (!resolved) {
    return undefined;
  }
  return dereferenceSchema(resolved, resolver, seenRefs);
}

function dedupeEndpoints(endpoints: EndpointContract[]): EndpointContract[] {
  const byKey = new Map<string, EndpointContract>();
  for (const endpoint of endpoints) {
    const key = `${endpoint.method} ${endpoint.path}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, endpoint);
      continue;
    }
    const existingWeight = existing.requestFields.length + existing.responseFields.length;
    const nextWeight = endpoint.requestFields.length + endpoint.responseFields.length;
    if (nextWeight > existingWeight) {
      byKey.set(key, endpoint);
    }
  }
  return Array.from(byKey.values()).sort((left, right) => {
    if (left.path !== right.path) {
      return left.path.localeCompare(right.path);
    }
    return left.method.localeCompare(right.method);
  });
}

function dedupeFields(fields: FieldShape[]): FieldShape[] {
  const byName = new Map<string, FieldShape>();
  for (const field of fields) {
    const existing = byName.get(field.name);
    if (!existing) {
      byName.set(field.name, field);
      continue;
    }
    byName.set(field.name, {
      name: field.name,
      type: existing.type ?? field.type,
      required: Boolean(existing.required || field.required)
    });
  }
  return Array.from(byName.values());
}
