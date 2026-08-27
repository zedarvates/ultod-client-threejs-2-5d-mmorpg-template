import {
  CONTENT_ID_PATTERN,
  MAX_REFERENCES_PER_ENTITY,
  SEMVER_PATTERN,
  validateEntity,
} from "./validate-entity.js";
import type { ValidationDiagnostic, ValidationResult } from "./types.js";

/** Bounds work performed while validating untrusted graph collections. */
export const MAX_GRAPH_ENTITIES = 16384;
export const MAX_GRAPH_ROOTS = 16384;
export const MAX_GRAPH_REFERENCES = 65536;
export const MAX_CYCLE_SEARCH_STEPS = 100000;
export const MAX_CYCLE_DIAGNOSTICS = 1024;

const GRAPH_KEYS = new Set(["schema", "id", "version", "visibility", "roots", "entities"]);

type UnknownRecord = Record<string, unknown>;
type UntrustedAccess<T> = { accessible: true; value: T } | { accessible: false };

interface EntitySnapshot {
  id?: string;
  kind?: string;
  refs: ReferenceSnapshot[];
}

interface ReferenceSnapshot {
  predicate?: string;
  target?: string;
}

function accessUntrusted<T>(accessor: () => T): UntrustedAccess<T> {
  try {
    return { accessible: true, value: accessor() };
  } catch {
    return { accessible: false };
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareOrdinal(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function sortDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      compareOrdinal(left.code, right.code) ||
      compareOrdinal(left.path, right.path) ||
      compareOrdinal(left.message, right.message),
  );
}

function addDiagnostic(
  diagnostics: ValidationDiagnostic[],
  code: string,
  path: string,
  message: string,
): void {
  diagnostics.push({ code, path, message });
}

function graphKeyPath(key: PropertyKey): string {
  if (typeof key === "symbol") {
    return `$[${String(key)}]`;
  }
  const text = String(key);
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)
    ? `$.${text}`
    : `$[${JSON.stringify(text)}]`;
}

function invalidGraphAccess(): ValidationResult {
  return {
    valid: false,
    diagnostics: [
      {
        code: "invalid_graph_access",
        path: "$",
        message: "Graph properties could not be read",
      },
    ],
  };
}

function boundedArrayLength(value: unknown, maximum: number): UntrustedAccess<number | undefined> {
  const arrayAccess = accessUntrusted(() => Array.isArray(value));
  if (!arrayAccess.accessible) {
    return { accessible: false };
  }
  if (!arrayAccess.value) {
    return { accessible: true, value: undefined };
  }

  const lengthAccess = accessUntrusted(() => (value as unknown[]).length);
  if (!lengthAccess.accessible) {
    return { accessible: false };
  }
  if (
    !Number.isSafeInteger(lengthAccess.value) ||
    lengthAccess.value < 0 ||
    lengthAccess.value > maximum
  ) {
    return { accessible: false };
  }
  return { accessible: true, value: lengthAccess.value };
}

function prefixEntityPath(entityIndex: number, nestedPath: string): string {
  if (nestedPath.length === 0) {
    return `entities[${entityIndex}]`;
  }
  return `entities[${entityIndex}].${nestedPath}`;
}

function readEntitySnapshot(value: unknown): UntrustedAccess<EntitySnapshot> {
  const recordAccess = accessUntrusted(() => isRecord(value));
  if (!recordAccess.accessible) {
    return { accessible: false };
  }
  if (!recordAccess.value) {
    return { accessible: true, value: { refs: [] } };
  }

  const entity = value as UnknownRecord;
  const idAccess = accessUntrusted(() => entity.id);
  const kindAccess = accessUntrusted(() => entity.kind);
  const refsAccess = accessUntrusted(() => entity.refs);
  if (!idAccess.accessible || !kindAccess.accessible || !refsAccess.accessible) {
    return { accessible: false };
  }

  const refsLengthAccess = boundedArrayLength(refsAccess.value, MAX_REFERENCES_PER_ENTITY);
  if (!refsLengthAccess.accessible) {
    return { accessible: false };
  }

  const refs: ReferenceSnapshot[] = [];
  if (refsLengthAccess.value !== undefined) {
    const untrustedRefs = refsAccess.value as unknown[];
    for (let referenceIndex = 0; referenceIndex < refsLengthAccess.value; referenceIndex += 1) {
      const referenceAccess = accessUntrusted(() => untrustedRefs[referenceIndex]);
      if (!referenceAccess.accessible) {
        return { accessible: false };
      }
      const referenceRecordAccess = accessUntrusted(() => isRecord(referenceAccess.value));
      if (!referenceRecordAccess.accessible) {
        return { accessible: false };
      }
      if (!referenceRecordAccess.value) {
        refs.push({});
        continue;
      }

      const reference = referenceAccess.value as UnknownRecord;
      const predicateAccess = accessUntrusted(() => reference.predicate);
      const targetAccess = accessUntrusted(() => reference.target);
      if (!predicateAccess.accessible || !targetAccess.accessible) {
        return { accessible: false };
      }
      refs.push({
        predicate: typeof predicateAccess.value === "string" ? predicateAccess.value : undefined,
        target: typeof targetAccess.value === "string" ? targetAccess.value : undefined,
      });
    }
  }

  return {
    accessible: true,
    value: {
      id: typeof idAccess.value === "string" ? idAccess.value : undefined,
      kind: typeof kindAccess.value === "string" ? kindAccess.value : undefined,
      refs,
    },
  };
}

function addQuestCycleDiagnostics(
  diagnostics: ValidationDiagnostic[],
  entitiesById: Map<string, EntitySnapshot>,
): void {
  const questIds = [...entitiesById.entries()]
    .filter(([, entity]) => entity.kind === "quest")
    .map(([id]) => id)
    .sort(compareOrdinal);
  const questIdSet = new Set(questIds);
  const adjacency = new Map<string, string[]>();
  let referenceCount = 0;

  for (const questId of questIds) {
    const entity = entitiesById.get(questId);
    const targets = new Set<string>();
    if (entity !== undefined) {
      for (const reference of entity.refs) {
        referenceCount += 1;
        if (referenceCount > MAX_GRAPH_REFERENCES) {
          return;
        }
        if (
          reference.predicate === "requires" &&
          reference.target !== undefined &&
          questIdSet.has(reference.target)
        ) {
          targets.add(reference.target);
        }
      }
    }
    adjacency.set(questId, [...targets].sort(compareOrdinal));
  }

  const signatures = new Set<string>();
  let searchSteps = 0;

  for (const startId of questIds) {
    const path = [startId];
    const pathIds = new Set(path);
    const frames: Array<{ id: string; nextTargetIndex: number }> = [
      { id: startId, nextTargetIndex: 0 },
    ];

    while (frames.length > 0) {
      const frame = frames[frames.length - 1];
      if (frame === undefined) {
        break;
      }
      const targets = adjacency.get(frame.id) ?? [];
      const target = targets[frame.nextTargetIndex];
      if (target === undefined) {
        frames.pop();
        pathIds.delete(frame.id);
        path.pop();
        continue;
      }
      frame.nextTargetIndex += 1;

      searchSteps += 1;
      if (searchSteps > MAX_CYCLE_SEARCH_STEPS) {
        addDiagnostic(
          diagnostics,
          "quest_cycle_search_limit_exceeded",
          "entities",
          `quest cycle search exceeded ${MAX_CYCLE_SEARCH_STEPS} steps`,
        );
        return;
      }

      if (compareOrdinal(target, startId) < 0) {
        continue;
      }

      if (target === startId) {
        const signature = [...path].sort(compareOrdinal).join("\u0000");
        if (!signatures.has(signature)) {
          if (signatures.size >= MAX_CYCLE_DIAGNOSTICS) {
            addDiagnostic(
              diagnostics,
              "quest_cycle_diagnostic_limit_exceeded",
              "entities",
              `quest cycle diagnostics exceeded ${MAX_CYCLE_DIAGNOSTICS} signatures`,
            );
            return;
          }
          signatures.add(signature);
        }
        continue;
      }

      if (pathIds.has(target)) {
        continue;
      }
      pathIds.add(target);
      path.push(target);
      frames.push({ id: target, nextTargetIndex: 0 });
    }
  }

  for (const signature of [...signatures].sort(compareOrdinal)) {
    addDiagnostic(
      diagnostics,
      "quest-prerequisite-cycle",
      "entities",
      `quest prerequisite cycle: ${signature.split("\u0000").join(", ")}`,
    );
  }
}

export function validateContentGraph(value: unknown): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];
  const graphRecordAccess = accessUntrusted(() => isRecord(value));
  if (!graphRecordAccess.accessible) {
    return invalidGraphAccess();
  }
  if (!graphRecordAccess.value) {
    addDiagnostic(diagnostics, "invalid_graph", "", "graph must be a non-null object");
    return { valid: false, diagnostics };
  }

  const graph = value as UnknownRecord;
  const ownKeysAccess = accessUntrusted(() => Reflect.ownKeys(graph));
  if (!ownKeysAccess.accessible) {
    return invalidGraphAccess();
  }
  const unknownKeys = ownKeysAccess.value
    .filter((key) => typeof key !== "string" || !GRAPH_KEYS.has(key))
    .sort((left, right) => compareOrdinal(String(left), String(right)));
  for (const key of unknownKeys) {
    addDiagnostic(
      diagnostics,
      "unknown_graph_key",
      graphKeyPath(key),
      `unknown top-level graph key: ${String(key)}`,
    );
  }

  const schemaAccess = accessUntrusted(() => graph.schema);
  const idAccess = accessUntrusted(() => graph.id);
  const versionAccess = accessUntrusted(() => graph.version);
  const visibilityAccess = accessUntrusted(() => graph.visibility);
  const rootsAccess = accessUntrusted(() => graph.roots);
  const entitiesAccess = accessUntrusted(() => graph.entities);
  if (
    !schemaAccess.accessible ||
    !idAccess.accessible ||
    !versionAccess.accessible ||
    !visibilityAccess.accessible ||
    !rootsAccess.accessible ||
    !entitiesAccess.accessible
  ) {
    return invalidGraphAccess();
  }

  if (schemaAccess.value !== "uo.game-content-graph/v1") {
    addDiagnostic(
      diagnostics,
      "invalid_graph_schema",
      "schema",
      "schema must be uo.game-content-graph/v1",
    );
  }
  if (typeof idAccess.value !== "string" || !CONTENT_ID_PATTERN.test(idAccess.value)) {
    addDiagnostic(
      diagnostics,
      "invalid_graph_id",
      "id",
      "graph id must match /^[a-z0-9][a-z0-9._-]{2,127}$/",
    );
  }
  if (typeof versionAccess.value !== "string" || !SEMVER_PATTERN.test(versionAccess.value)) {
    addDiagnostic(
      diagnostics,
      "invalid_graph_version",
      "version",
      "graph version must be a semantic version",
    );
  }
  if (
    visibilityAccess.value !== "public" &&
    visibilityAccess.value !== "private" &&
    visibilityAccess.value !== "local"
  ) {
    addDiagnostic(
      diagnostics,
      "invalid_graph_visibility",
      "visibility",
      "visibility must be public, private, or local",
    );
  }

  const rootsLengthAccess = boundedArrayLength(rootsAccess.value, MAX_GRAPH_ROOTS);
  const entitiesLengthAccess = boundedArrayLength(entitiesAccess.value, MAX_GRAPH_ENTITIES);
  if (!rootsLengthAccess.accessible || !entitiesLengthAccess.accessible) {
    return invalidGraphAccess();
  }
  if (rootsLengthAccess.value === undefined) {
    addDiagnostic(diagnostics, "invalid_roots", "roots", "roots must be an array");
  }
  if (entitiesLengthAccess.value === undefined) {
    addDiagnostic(diagnostics, "invalid_entities", "entities", "entities must be an array");
  }

  const roots: Array<string | undefined> = [];
  const rootIds = new Set<string>();
  if (rootsLengthAccess.value !== undefined) {
    const untrustedRoots = rootsAccess.value as unknown[];
    for (let rootIndex = 0; rootIndex < rootsLengthAccess.value; rootIndex += 1) {
      const rootAccess = accessUntrusted(() => untrustedRoots[rootIndex]);
      if (!rootAccess.accessible) {
        return invalidGraphAccess();
      }
      if (typeof rootAccess.value !== "string") {
        addDiagnostic(
          diagnostics,
          "invalid_root",
          `roots[${rootIndex}]`,
          "root must be a string entity id",
        );
        roots.push(undefined);
      } else {
        roots.push(rootAccess.value);
        if (rootIds.has(rootAccess.value)) {
          addDiagnostic(
            diagnostics,
            "duplicate_root",
            `$.roots[${rootIndex}]`,
            `Duplicate root: ${rootAccess.value}`,
          );
        } else {
          rootIds.add(rootAccess.value);
        }
      }
    }
  }

  const entities: EntitySnapshot[] = [];
  const entitiesById = new Map<string, EntitySnapshot>();
  let totalReferenceCount = 0;
  if (entitiesLengthAccess.value !== undefined) {
    const untrustedEntities = entitiesAccess.value as unknown[];
    for (let entityIndex = 0; entityIndex < entitiesLengthAccess.value; entityIndex += 1) {
      const entityAccess = accessUntrusted(() => untrustedEntities[entityIndex]);
      if (!entityAccess.accessible) {
        return invalidGraphAccess();
      }

      const validationAccess = accessUntrusted(() => validateEntity(entityAccess.value));
      if (!validationAccess.accessible) {
        return invalidGraphAccess();
      }
      for (const diagnostic of validationAccess.value.diagnostics) {
        addDiagnostic(
          diagnostics,
          diagnostic.code,
          prefixEntityPath(entityIndex, diagnostic.path),
          diagnostic.message,
        );
      }

      const snapshotAccess = readEntitySnapshot(entityAccess.value);
      if (!snapshotAccess.accessible) {
        return invalidGraphAccess();
      }
      const snapshot = snapshotAccess.value;
      entities.push(snapshot);
      totalReferenceCount += snapshot.refs.length;
      if (totalReferenceCount > MAX_GRAPH_REFERENCES) {
        return invalidGraphAccess();
      }

      if (snapshot.id !== undefined && CONTENT_ID_PATTERN.test(snapshot.id)) {
        if (entitiesById.has(snapshot.id)) {
          addDiagnostic(
            diagnostics,
            "duplicate_entity_id",
            `entities[${entityIndex}].id`,
            `duplicate entity id: ${snapshot.id}`,
          );
        } else {
          entitiesById.set(snapshot.id, snapshot);
        }
      }
    }
  }

  for (let rootIndex = 0; rootIndex < roots.length; rootIndex += 1) {
    const root = roots[rootIndex];
    if (root !== undefined && !entitiesById.has(root)) {
      addDiagnostic(
        diagnostics,
        "missing_root",
        `roots[${rootIndex}]`,
        `root target does not exist: ${root}`,
      );
    }
  }

  for (let entityIndex = 0; entityIndex < entities.length; entityIndex += 1) {
    const entity = entities[entityIndex];
    if (entity === undefined) {
      continue;
    }
    for (let referenceIndex = 0; referenceIndex < entity.refs.length; referenceIndex += 1) {
      const target = entity.refs[referenceIndex]?.target;
      if (target !== undefined && !entitiesById.has(target)) {
        addDiagnostic(
          diagnostics,
          "dangling_reference",
          `entities[${entityIndex}].refs[${referenceIndex}].target`,
          `reference target does not exist: ${target}`,
        );
      }
    }
  }

  addQuestCycleDiagnostics(diagnostics, entitiesById);

  return {
    valid: diagnostics.length === 0,
    diagnostics: sortDiagnostics(diagnostics),
  };
}
