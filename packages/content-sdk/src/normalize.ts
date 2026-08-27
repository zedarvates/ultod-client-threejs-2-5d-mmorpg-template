import type { ContentEntity, ContentReference, GameContentGraph } from "./types.js";

export class CanonicalizationError extends TypeError {
  readonly code = "unsupported_canonical_value" as const;
  readonly path: string;

  constructor(path: string) {
    super(`Unsupported canonical value at ${path}`);
    this.name = "CanonicalizationError";
    this.path = path;
  }
}

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

function unsupported(path: string): never {
  throw new CanonicalizationError(path);
}

function diagnosticField(value: unknown, field: string): string {
  if (value === null || typeof value !== "object") {
    return "";
  }

  try {
    const fieldValue = Reflect.get(value, field);
    return typeof fieldValue === "string" ? fieldValue : "";
  } catch {
    return "";
  }
}

function compareDiagnostics(left: unknown, right: unknown): number {
  return (
    compareOrdinal(diagnosticField(left, "code"), diagnosticField(right, "code")) ||
    compareOrdinal(diagnosticField(left, "path"), diagnosticField(right, "path")) ||
    compareOrdinal(diagnosticField(left, "message"), diagnosticField(right, "message")) ||
    compareCanonical(left, right)
  );
}

/**
 * Produces JSON-safe canonical data without invoking user serialization hooks.
 * Unsupported leaves, object types, inaccessible properties, symbol-keyed
 * records, sparse arrays, and cycle back-edges fail with a stable path error.
 */
function normalizeUnknown(
  value: unknown,
  ancestors: Set<object>,
  path: string,
  collectionName?: string,
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : unsupported(path);
  }
  if (typeof value !== "object") {
    return unsupported(path);
  }

  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    return unsupported(path);
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return unsupported(path);
    }
    ancestors.add(value);
    try {
      const normalized: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const itemPath = `${path}[${index}]`;
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          unsupported(itemPath);
        }
        let item: unknown;
        try {
          item = Reflect.get(value, index);
        } catch {
          item = unsupported(itemPath);
        }
        normalized.push(normalizeUnknown(item, ancestors, itemPath));
      }
      return collectionName === "diagnostics"
        ? normalized.sort(compareDiagnostics)
        : normalized;
    } catch (error) {
      if (error instanceof CanonicalizationError) {
        throw error;
      }
      throw new CanonicalizationError(path);
    } finally {
      ancestors.delete(value);
    }
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return unsupported(path);
  }
  if (ancestors.has(value)) {
    return unsupported(path);
  }

  ancestors.add(value);
  try {
    if (Object.getOwnPropertySymbols(value).length > 0) {
      return unsupported(path);
    }

    const normalized = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(value).sort(compareOrdinal)) {
      const nestedPath = objectPath(path, key);
      let nestedValue: unknown;
      try {
        nestedValue = Reflect.get(value, key);
      } catch {
        nestedValue = unsupported(nestedPath);
      }
      Object.defineProperty(normalized, key, {
        configurable: true,
        enumerable: true,
        value: normalizeUnknown(nestedValue, ancestors, nestedPath, key),
        writable: true,
      });
    }
    return normalized;
  } catch (error) {
    if (error instanceof CanonicalizationError) {
      throw error;
    }
    return unsupported(path);
  } finally {
    ancestors.delete(value);
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

function normalizeEntity(entity: ContentEntity<unknown>, path: string): ContentEntity<unknown> {
  const normalized = normalizeUnknown(entity, new Set(), path) as ContentEntity<unknown>;
  normalized.refs = [...normalized.refs].sort(compareReferences);
  return normalized;
}

export function normalizeContentGraph(graph: GameContentGraph): GameContentGraph {
  const normalized = normalizeUnknown(
    {
      schema: graph.schema,
      id: graph.id,
      version: graph.version,
      visibility: graph.visibility,
      roots: [...graph.roots].sort(compareOrdinal),
      entities: graph.entities
        .map((entity, index) => normalizeEntity(entity, `$.entities[${index}]`))
        .sort((left, right) => compareOrdinal(left.id, right.id)),
    },
    new Set(),
    "$",
  );

  return normalized as GameContentGraph;
}

export function serializeCanonicalGraph(graph: GameContentGraph): string {
  return JSON.stringify(normalizeContentGraph(graph));
}
