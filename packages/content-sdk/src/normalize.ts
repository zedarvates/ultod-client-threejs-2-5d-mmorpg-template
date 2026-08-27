import type { ContentEntity, ContentReference, GameContentGraph } from "./types.js";
import { MAX_GRAPH_OWN_KEYS } from "./validate-graph.js";

export const MAX_CANONICAL_DEPTH = 64;
export const MAX_CANONICAL_NODES = 65_536;
export const MAX_CANONICAL_ARRAY_ITEMS = 16_384;

export type CanonicalizationErrorCode =
  | "unsupported_canonical_value"
  | "unknown_graph_key"
  | "graph_key_limit_exceeded"
  | "canonical_access_error"
  | "canonical_array_limit_exceeded"
  | "canonical_depth_limit_exceeded"
  | "canonical_node_limit_exceeded";

export class CanonicalizationError extends TypeError {
  readonly code: CanonicalizationErrorCode;
  readonly path: string;

  constructor(path: string, code: CanonicalizationErrorCode = "unsupported_canonical_value") {
    super(`Canonicalization failed with ${code} at ${path}`);
    this.name = "CanonicalizationError";
    this.code = code;
    this.path = path;
  }
}

interface CanonicalContext {
  readonly ancestors: Set<object>;
  nodes: number;
}

const GRAPH_KEYS = new Set(["schema", "id", "version", "visibility", "roots", "entities"]);

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCanonical(left: unknown, right: unknown): number {
  return compareOrdinal(JSON.stringify(left), JSON.stringify(right));
}

function objectPath(path: string, key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
    ? `${path}.${key}`
    : `${path}[${JSON.stringify(key)}]`;
}

function fail(path: string, code: CanonicalizationErrorCode): never {
  throw new CanonicalizationError(path, code);
}

function readAccess<T>(path: string, read: () => T): T {
  try {
    return read();
  } catch {
    return fail(path, "canonical_access_error");
  }
}

function enterNode(context: CanonicalContext, path: string, depth: number): void {
  if (depth > MAX_CANONICAL_DEPTH) fail(path, "canonical_depth_limit_exceeded");
  context.nodes += 1;
  if (context.nodes > MAX_CANONICAL_NODES) fail(path, "canonical_node_limit_exceeded");
}

function diagnosticField(value: unknown, field: string): string {
  if (value === null || typeof value !== "object") return "";
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === "string" ? fieldValue : "";
}

function compareDiagnostics(left: unknown, right: unknown): number {
  return (
    compareOrdinal(diagnosticField(left, "code"), diagnosticField(right, "code")) ||
    compareOrdinal(diagnosticField(left, "path"), diagnosticField(right, "path")) ||
    compareOrdinal(diagnosticField(left, "message"), diagnosticField(right, "message")) ||
    compareCanonical(left, right)
  );
}

/** Bounded JSON-safe canonicalization without untrusted iterator or array-method dispatch. */
function normalizeUnknown(
  value: unknown,
  context: CanonicalContext,
  path: string,
  depth: number,
  collectionName?: string,
  ownKeysSnapshot?: readonly PropertyKey[],
): unknown {
  enterNode(context, path, depth);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fail(path, "unsupported_canonical_value");
  }
  if (typeof value !== "object") return fail(path, "unsupported_canonical_value");

  const prototype = readAccess(path, () => Object.getPrototypeOf(value));
  const isArray = readAccess(path, () => Array.isArray(value));
  if (isArray) {
    if (context.ancestors.has(value)) return fail(path, "unsupported_canonical_value");
    const length = readAccess(path, () => (value as unknown[]).length);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_CANONICAL_ARRAY_ITEMS) {
      return fail(path, "canonical_array_limit_exceeded");
    }

    context.ancestors.add(value);
    try {
      const normalized: unknown[] = [];
      for (let index = 0; index < length; index += 1) {
        const itemPath = `${path}[${index}]`;
        const descriptor = readAccess(itemPath, () =>
          Reflect.getOwnPropertyDescriptor(value, String(index)),
        );
        if (descriptor === undefined) fail(itemPath, "unsupported_canonical_value");
        const item = readAccess(itemPath, () => Reflect.get(value, String(index)));
        normalized.push(normalizeUnknown(item, context, itemPath, depth + 1));
      }
      return collectionName === "diagnostics" ? normalized.sort(compareDiagnostics) : normalized;
    } finally {
      context.ancestors.delete(value);
    }
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, "unsupported_canonical_value");
  }
  if (context.ancestors.has(value)) return fail(path, "unsupported_canonical_value");

  context.ancestors.add(value);
  try {
    const ownKeys = ownKeysSnapshot ?? readAccess(path, () => Reflect.ownKeys(value));
    if (ownKeys.length > MAX_CANONICAL_NODES - context.nodes) {
      return fail(path, "canonical_node_limit_exceeded");
    }
    const stringKeys: string[] = [];
    for (let index = 0; index < ownKeys.length; index += 1) {
      const key = ownKeys[index];
      if (typeof key !== "string") return fail(path, "unsupported_canonical_value");
      stringKeys.push(key);
    }
    stringKeys.sort(compareOrdinal);

    const normalized = Object.create(null) as Record<string, unknown>;
    for (let index = 0; index < stringKeys.length; index += 1) {
      const key = stringKeys[index];
      if (key === undefined) continue;
      const nestedPath = objectPath(path, key);
      const nestedValue = readAccess(nestedPath, () => Reflect.get(value, key));
      Object.defineProperty(normalized, key, {
        configurable: true,
        enumerable: true,
        value: normalizeUnknown(nestedValue, context, nestedPath, depth + 1, key),
        writable: true,
      });
    }
    return normalized;
  } finally {
    context.ancestors.delete(value);
  }
}

function referenceField(reference: ContentReference, field: keyof ContentReference): string {
  const value = reference[field];
  return typeof value === "string" ? value : "";
}

function compareReferences(left: ContentReference, right: ContentReference): number {
  return (
    compareOrdinal(referenceField(left, "predicate"), referenceField(right, "predicate")) ||
    compareOrdinal(referenceField(left, "target"), referenceField(right, "target")) ||
    compareOrdinal(referenceField(left, "version"), referenceField(right, "version"))
  );
}

function requireArray(value: unknown, path: string): unknown[] {
  return Array.isArray(value) ? value : fail(path, "unsupported_canonical_value");
}

function sortNormalizedGraph(graph: Record<string, unknown>): GameContentGraph {
  const roots = requireArray(graph.roots, "$.roots");
  for (let index = 0; index < roots.length; index += 1) {
    if (typeof roots[index] !== "string") fail(`$.roots[${index}]`, "unsupported_canonical_value");
  }
  (roots as string[]).sort(compareOrdinal);

  const entities = requireArray(graph.entities, "$.entities");
  for (let entityIndex = 0; entityIndex < entities.length; entityIndex += 1) {
    const entity = entities[entityIndex];
    const entityPath = `$.entities[${entityIndex}]`;
    if (entity === null || typeof entity !== "object" || Array.isArray(entity)) {
      fail(entityPath, "unsupported_canonical_value");
    }
    const entityRecord = entity as ContentEntity<unknown>;
    if (typeof entityRecord.id !== "string") fail(`${entityPath}.id`, "unsupported_canonical_value");
    const refs = requireArray(entityRecord.refs, `${entityPath}.refs`) as ContentReference[];
    for (let referenceIndex = 0; referenceIndex < refs.length; referenceIndex += 1) {
      const reference = refs[referenceIndex];
      if (reference === null || typeof reference !== "object" || Array.isArray(reference)) {
        fail(`${entityPath}.refs[${referenceIndex}]`, "unsupported_canonical_value");
      }
    }
    refs.sort(compareReferences);
  }
  (entities as ContentEntity<unknown>[]).sort((left, right) => compareOrdinal(left.id, right.id));
  return graph as unknown as GameContentGraph;
}

function snapshotGraphOwnKeys(graph: GameContentGraph): readonly PropertyKey[] {
  if (graph === null || typeof graph !== "object" || Array.isArray(graph)) {
    fail("$", "unsupported_canonical_value");
  }
  const ownKeys = readAccess("$", () => Reflect.ownKeys(graph));
  if (ownKeys.length > MAX_GRAPH_OWN_KEYS) {
    fail("$", "graph_key_limit_exceeded");
  }
  const unknownKeys: PropertyKey[] = [];
  for (let index = 0; index < ownKeys.length; index += 1) {
    const key = ownKeys[index];
    if (key !== undefined && (typeof key !== "string" || !GRAPH_KEYS.has(key))) unknownKeys.push(key);
  }
  unknownKeys.sort((left, right) => compareOrdinal(String(left), String(right)));
  const first = unknownKeys[0];
  if (first !== undefined) {
    const path = typeof first === "string" ? objectPath("$", first) : `$[${String(first)}]`;
    fail(path, "unknown_graph_key");
  }
  return ownKeys;
}

export function normalizeContentGraph(graph: GameContentGraph): GameContentGraph {
  const ownKeys = snapshotGraphOwnKeys(graph);
  const normalized = normalizeUnknown(
    graph,
    { ancestors: new Set(), nodes: 0 },
    "$",
    0,
    undefined,
    ownKeys,
  );
  if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
    return fail("$", "unsupported_canonical_value");
  }
  return sortNormalizedGraph(normalized as Record<string, unknown>);
}

export function serializeCanonicalGraph(graph: GameContentGraph): string {
  return JSON.stringify(normalizeContentGraph(graph));
}
