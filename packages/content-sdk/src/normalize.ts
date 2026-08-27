import type { ContentEntity, ContentReference, GameContentGraph } from "./types.js";

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareCanonical(left: unknown, right: unknown): number {
  return compareOrdinal(JSON.stringify(left), JSON.stringify(right));
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
 * Unsupported leaves, non-plain objects, inaccessible properties, symbol-keyed
 * records, and cycle back-edges are represented as null instead of throwing.
 */
function normalizeUnknown(
  value: unknown,
  ancestors: Set<object>,
  collectionName?: string,
): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "object") {
    return null;
  }

  let prototype: object | null;
  try {
    prototype = Object.getPrototypeOf(value);
  } catch {
    return null;
  }

  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      return null;
    }
    ancestors.add(value);
    let normalized: unknown[];
    try {
      normalized = Array.from(value, (item) => normalizeUnknown(item, ancestors));
    } catch {
      normalized = [];
    } finally {
      ancestors.delete(value);
    }
    return collectionName === "diagnostics"
      ? normalized.sort(compareDiagnostics)
      : normalized;
  }

  if (prototype !== Object.prototype && prototype !== null) {
    return null;
  }
  if (ancestors.has(value)) {
    return null;
  }

  ancestors.add(value);
  try {
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => typeof key === "symbol")) {
      return null;
    }

    const normalized: Record<string, unknown> = {};
    for (const key of (keys as string[]).sort(compareOrdinal)) {
      let nestedValue: unknown;
      try {
        nestedValue = Reflect.get(value, key);
      } catch {
        nestedValue = null;
      }
      normalized[key] = normalizeUnknown(nestedValue, ancestors, key);
    }
    return normalized;
  } catch {
    return null;
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

function normalizeEntity(entity: ContentEntity<unknown>): ContentEntity<unknown> {
  const normalized = normalizeUnknown(entity, new Set()) as ContentEntity<unknown>;
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
      entities: graph.entities.map(normalizeEntity).sort((left, right) =>
        compareOrdinal(left.id, right.id),
      ),
    },
    new Set(),
  );

  return normalized as GameContentGraph;
}

export function serializeCanonicalGraph(graph: GameContentGraph): string {
  return JSON.stringify(normalizeContentGraph(graph));
}
