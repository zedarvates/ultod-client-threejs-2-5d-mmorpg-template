import type { ContentEntity, ContentKind, ValidationDiagnostic } from "../types.js";
import { CONTENT_ID_PATTERN, SEMVER_PATTERN, validateEntity } from "../validate-entity.js";
import {
  MAX_ADAPTER_RECORDS,
  buildDraftEntity,
  createAdapterContext,
  sanitizeDraftValue,
  sanitizeReferences,
  sortDiagnostics,
} from "./adapter-common.js";
import type { DraftAdapterResult } from "./adapter-types.js";

export interface StoryCoreDraftRecord {
  id: string;
  refs?: unknown;
  [key: string]: unknown;
}

export interface StoryCoreAuthoringDraft {
  schema: "authoring-draft/v1";
  id: string;
  version: string;
  license: { id: string };
  world?: StoryCoreDraftRecord[];
  characters?: StoryCoreDraftRecord[];
  locations?: StoryCoreDraftRecord[];
  quests?: StoryCoreDraftRecord[];
  dialogues?: StoryCoreDraftRecord[];
  artifacts?: StoryCoreDraftRecord[];
}

const STORYCORE_COLLECTIONS = [
  ["world", "realm"],
  ["characters", "character"],
  ["locations", "location"],
  ["quests", "quest"],
  ["dialogues", "dialogue"],
  ["artifacts", "artifact"],
] as const satisfies ReadonlyArray<readonly [string, ContentKind]>;

const NARRATIVE_FIELDS = [
  "atmosphere",
  "description",
  "lines",
  "motivation",
  "name",
  "objectives",
  "relationships",
  "summary",
  "title",
] as const;

type UnknownRecord = Record<string, unknown>;

function safeGet(record: object, key: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: Reflect.get(record, key) };
  } catch {
    return { ok: false };
  }
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function prefixedEntityDiagnostics(
  diagnostics: ValidationDiagnostic[],
  basePath: string,
  entity: ContentEntity<unknown>,
): boolean {
  const validation = validateEntity(entity);
  if (validation.valid) return true;
  for (let index = 0; index < validation.diagnostics.length; index += 1) {
    const diagnostic = validation.diagnostics[index];
    if (diagnostic === undefined) continue;
    diagnostics.push({
      code: diagnostic.code,
      path: diagnostic.path.length === 0 ? basePath : `${basePath}.${diagnostic.path}`,
      message: diagnostic.message,
    });
  }
  return false;
}

export function adaptStoryCoreDraft(value: unknown): DraftAdapterResult {
  const context = createAdapterContext();
  const emptySource = {
    system: "storycore" as const,
    id: "",
    version: "",
    retained: true as const,
  };

  let root: UnknownRecord;
  try {
    if (!isPlainRecord(value)) {
      context.diagnostics.push({
        code: "invalid_storycore_draft",
        path: "$",
        message: "StoryCore draft must be a plain object",
      });
      return { entities: [], diagnostics: context.diagnostics, source: emptySource };
    }
    root = value;
  } catch {
    context.diagnostics.push({
      code: "adapter_access_error",
      path: "$",
      message: "adapter source could not be accessed",
    });
    return { entities: [], diagnostics: context.diagnostics, source: emptySource };
  }

  const schemaAccess = safeGet(root, "schema");
  const idAccess = safeGet(root, "id");
  const versionAccess = safeGet(root, "version");
  const licenseAccess = safeGet(root, "license");
  if (!schemaAccess.ok || !idAccess.ok || !versionAccess.ok || !licenseAccess.ok) {
    context.diagnostics.push({
      code: "adapter_access_error",
      path: "$",
      message: "adapter source could not be accessed",
    });
    return { entities: [], diagnostics: context.diagnostics, source: emptySource };
  }

  const source = {
    system: "storycore" as const,
    id: typeof idAccess.value === "string" ? idAccess.value : "",
    version: typeof versionAccess.value === "string" ? versionAccess.value : "",
    retained: true as const,
  };
  if (schemaAccess.value !== "authoring-draft/v1") {
    context.diagnostics.push({
      code: "invalid_storycore_schema",
      path: "schema",
      message: "StoryCore schema must be authoring-draft/v1",
    });
  }
  if (typeof idAccess.value !== "string" || !CONTENT_ID_PATTERN.test(idAccess.value)) {
    context.diagnostics.push({
      code: "invalid_source_id",
      path: "id",
      message: "adapter source id must be a stable content id",
    });
  }
  if (typeof versionAccess.value !== "string" || !SEMVER_PATTERN.test(versionAccess.value)) {
    context.diagnostics.push({
      code: "invalid_source_version",
      path: "version",
      message: "adapter source version must be semantic",
    });
  }

  let licenseId = "";
  try {
    if (isPlainRecord(licenseAccess.value)) {
      const licenseIdAccess = safeGet(licenseAccess.value, "id");
      if (licenseIdAccess.ok && typeof licenseIdAccess.value === "string") {
        licenseId = licenseIdAccess.value;
      }
    }
  } catch {
    licenseId = "";
  }
  if (licenseId.length === 0) {
    context.diagnostics.push({
      code: "missing_adapter_license",
      path: "license",
      message: "adapter source requires a non-empty license id",
    });
  }
  if (context.diagnostics.length > 0) {
    return { entities: [], diagnostics: sortDiagnostics(context.diagnostics), source };
  }

  const entities: ContentEntity<unknown>[] = [];
  const ids = new Set<string>();
  for (let collectionIndex = 0; collectionIndex < STORYCORE_COLLECTIONS.length; collectionIndex += 1) {
    const mapping = STORYCORE_COLLECTIONS[collectionIndex];
    if (mapping === undefined) continue;
    const [collectionName, kind] = mapping;
    const collectionAccess = safeGet(root, collectionName);
    if (!collectionAccess.ok) {
      context.diagnostics.push({
        code: "adapter_access_error",
        path: collectionName,
        message: "adapter collection could not be accessed",
      });
      continue;
    }
    if (collectionAccess.value === undefined) continue;
    let isArray = false;
    try {
      isArray = Array.isArray(collectionAccess.value);
    } catch {
      context.diagnostics.push({
        code: "adapter_access_error",
        path: collectionName,
        message: "adapter collection could not be accessed",
      });
      continue;
    }
    if (!isArray) {
      context.diagnostics.push({
        code: "invalid_adapter_collection",
        path: collectionName,
        message: "adapter collection must be an array",
      });
      continue;
    }
    const records = collectionAccess.value as unknown[];
    let length = 0;
    try {
      length = records.length;
    } catch {
      context.diagnostics.push({
        code: "adapter_access_error",
        path: collectionName,
        message: "adapter collection could not be accessed",
      });
      continue;
    }
    if (!Number.isSafeInteger(length) || length < 0) {
      context.diagnostics.push({
        code: "adapter_access_error",
        path: collectionName,
        message: "adapter collection could not be accessed",
      });
      continue;
    }
    if (length > MAX_ADAPTER_RECORDS) {
      context.diagnostics.push({
        code: "adapter_record_limit_exceeded",
        path: collectionName,
        message: `adapter collection must contain at most ${MAX_ADAPTER_RECORDS} records`,
      });
      continue;
    }

    for (let recordIndex = 0; recordIndex < length; recordIndex += 1) {
      const recordPath = `${collectionName}[${recordIndex}]`;
      let recordValue: unknown;
      try {
        recordValue = records[recordIndex];
      } catch {
        context.diagnostics.push({
          code: "adapter_access_error",
          path: recordPath,
          message: "adapter record could not be accessed",
        });
        continue;
      }
      let record: UnknownRecord;
      try {
        if (!isPlainRecord(recordValue)) {
          context.diagnostics.push({
            code: "invalid_source_record",
            path: recordPath,
            message: "adapter record must be a plain object",
          });
          continue;
        }
        record = recordValue;
      } catch {
        context.diagnostics.push({
          code: "adapter_access_error",
          path: recordPath,
          message: "adapter record could not be accessed",
        });
        continue;
      }
      const recordIdAccess = safeGet(record, "id");
      if (!recordIdAccess.ok || typeof recordIdAccess.value !== "string" || !CONTENT_ID_PATTERN.test(recordIdAccess.value)) {
        context.diagnostics.push({
          code: "invalid_source_id",
          path: `${recordPath}.id`,
          message: "adapter record requires a stable content id",
        });
        continue;
      }
      if (ids.has(recordIdAccess.value)) {
        context.diagnostics.push({
          code: "duplicate_source_id",
          path: `${recordPath}.id`,
          message: `duplicate adapter source id: ${recordIdAccess.value}`,
        });
        continue;
      }
      ids.add(recordIdAccess.value);

      const sanitized = sanitizeDraftValue(record, recordPath, context);
      const sanitizedRecord = sanitized !== null && typeof sanitized === "object"
        ? sanitized as Record<string, unknown>
        : Object.create(null) as Record<string, unknown>;
      const content = Object.create(null) as Record<string, unknown>;
      for (let fieldIndex = 0; fieldIndex < NARRATIVE_FIELDS.length; fieldIndex += 1) {
        const field = NARRATIVE_FIELDS[fieldIndex];
        if (field === undefined || !Object.prototype.hasOwnProperty.call(sanitizedRecord, field)) continue;
        Object.defineProperty(content, field, {
          configurable: true,
          enumerable: true,
          value: sanitizedRecord[field],
          writable: true,
        });
      }
      const refsAccess = safeGet(record, "refs");
      const refs = sanitizeReferences(refsAccess.ok ? refsAccess.value : undefined, `${recordPath}.refs`, context);
      const entity = buildDraftEntity({
        id: recordIdAccess.value,
        kind,
        version: versionAccess.value as string,
        licenseId,
        content,
        refs,
      });
      if (prefixedEntityDiagnostics(context.diagnostics, recordPath, entity)) {
        entities.push(entity);
      }
    }
  }

  entities.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
  return {
    entities,
    diagnostics: sortDiagnostics(context.diagnostics),
    source,
  };
}
