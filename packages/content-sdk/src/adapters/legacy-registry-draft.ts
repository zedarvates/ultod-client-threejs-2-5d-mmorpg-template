import type { ContentEntity, ContentKind } from "../types.js";
import { CONTENT_ID_PATTERN, SEMVER_PATTERN, validateEntity } from "../validate-entity.js";
import {
  buildDraftEntity,
  createAdapterContext,
  hasFatalAdapterDiagnostics,
  inspectAdapterOwnKeys,
  sanitizeDraftValue,
  sanitizeReferences,
  sortDiagnostics,
} from "./adapter-common.js";
import type { DraftAdapterResult } from "./adapter-types.js";

export interface LegacyRegistryTemplate {
  id: string;
  version: string;
  template_type: string;
  profile?: string;
  license: { id: string };
  data: Record<string, unknown>;
  refs?: unknown;
}

export const LEGACY_TEMPLATE_KIND_MAP = Object.freeze({
  realm: "realm",
  region: "region",
  location: "location",
  npc: "npc",
  character: "character",
  quest: "quest",
  dialogue: "dialogue",
  item: "item",
  creature: "creature_species",
  monster: "monster_variant",
  vendor: "vendor",
  recipe: "recipe",
} as const satisfies Readonly<Record<string, ContentKind>>);

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

export function adaptLegacyRegistryTemplate(value: unknown): DraftAdapterResult {
  const context = createAdapterContext();
  const emptySource = {
    system: "legacy-registry" as const,
    id: "",
    version: "",
    retained: true as const,
  };

  let root: UnknownRecord;
  try {
    if (!isPlainRecord(value)) {
      context.diagnostics.push({
        code: "invalid_legacy_template",
        path: "$",
        message: "legacy template must be a plain object",
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

  if (!inspectAdapterOwnKeys(root, "$", context, "adapter source could not be accessed")) {
    return { entities: [], diagnostics: sortDiagnostics(context.diagnostics), source: emptySource };
  }

  const idAccess = safeGet(root, "id");
  const versionAccess = safeGet(root, "version");
  const typeAccess = safeGet(root, "template_type");
  const licenseAccess = safeGet(root, "license");
  const dataAccess = safeGet(root, "data");
  const refsAccess = safeGet(root, "refs");
  if (
    !idAccess.ok ||
    !versionAccess.ok ||
    !typeAccess.ok ||
    !licenseAccess.ok ||
    !dataAccess.ok ||
    !refsAccess.ok
  ) {
    context.diagnostics.push({
      code: "adapter_access_error",
      path: "$",
      message: "adapter source could not be accessed",
    });
    return { entities: [], diagnostics: context.diagnostics, source: emptySource };
  }

  const source = {
    system: "legacy-registry" as const,
    id: typeof idAccess.value === "string" ? idAccess.value : "",
    version: typeof versionAccess.value === "string" ? versionAccess.value : "",
    retained: true as const,
  };
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

  let kind: ContentKind | undefined;
  if (typeof typeAccess.value === "string") {
    kind = LEGACY_TEMPLATE_KIND_MAP[typeAccess.value as keyof typeof LEGACY_TEMPLATE_KIND_MAP];
  }
  if (kind === undefined) {
    context.diagnostics.push({
      code: "unmapped_template_type",
      path: "template_type",
      message: `legacy template type is not whitelisted: ${String(typeAccess.value)}`,
    });
  }

  let licenseId = "";
  try {
    if (isPlainRecord(licenseAccess.value)) {
      const nested = safeGet(licenseAccess.value, "id");
      if (nested.ok && typeof nested.value === "string") licenseId = nested.value;
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

  let dataIsPlain = false;
  try {
    dataIsPlain = isPlainRecord(dataAccess.value);
  } catch {
    context.diagnostics.push({
      code: "adapter_access_error",
      path: "data",
      message: "legacy template data could not be accessed",
    });
  }
  if (!dataIsPlain) {
    context.diagnostics.push({
      code: "invalid_legacy_data",
      path: "data",
      message: "legacy template data must be a plain object",
    });
  }
  if (
    typeof idAccess.value !== "string" ||
    !CONTENT_ID_PATTERN.test(idAccess.value) ||
    typeof versionAccess.value !== "string" ||
    !SEMVER_PATTERN.test(versionAccess.value) ||
    kind === undefined ||
    licenseId.length === 0 ||
    !dataIsPlain
  ) {
    return { entities: [], diagnostics: sortDiagnostics(context.diagnostics), source };
  }

  const diagnosticStart = context.diagnostics.length;
  const content = sanitizeDraftValue(dataAccess.value, "data", context);
  if (content === undefined || hasFatalAdapterDiagnostics(context.diagnostics, diagnosticStart)) {
    return { entities: [], diagnostics: sortDiagnostics(context.diagnostics), source };
  }
  const refs = sanitizeReferences(refsAccess.value, "refs", context);
  const entity = buildDraftEntity({
    id: idAccess.value,
    kind,
    version: versionAccess.value,
    licenseId,
    content,
    refs,
  });
  const validation = validateEntity(entity);
  const entities: ContentEntity<unknown>[] = [];
  if (validation.valid) {
    entities.push(entity);
  } else {
    for (let index = 0; index < validation.diagnostics.length; index += 1) {
      const diagnostic = validation.diagnostics[index];
      if (diagnostic === undefined) continue;
      context.diagnostics.push({
        code: diagnostic.code,
        path: diagnostic.path.length === 0 ? "entity" : `entity.${diagnostic.path}`,
        message: diagnostic.message,
      });
    }
  }
  return {
    entities,
    diagnostics: sortDiagnostics(context.diagnostics),
    source,
  };
}
