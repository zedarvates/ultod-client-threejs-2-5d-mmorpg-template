import type { ContentEntity, ContentKind, ContentReference, ValidationDiagnostic } from "../types.js";
import { CONTENT_ID_PATTERN } from "../validate-entity.js";

export const MAX_ADAPTER_RECORDS = 4_096;
export const MAX_ADAPTER_OWN_KEYS = 64;
export const MAX_ADAPTER_DEPTH = 32;
export const MAX_ADAPTER_NODES = 65_536;
export const MAX_ADAPTER_ARRAY_ITEMS = 4_096;
export const MAX_ADAPTER_STRING_LENGTH = 16_384;

const FORBIDDEN_AUTHORITATIVE_FIELDS = new Set([
  "attack",
  "authority",
  "combat_stats",
  "currency",
  "damage",
  "database_id",
  "defense",
  "drop_rate",
  "health",
  "loot_chance",
  "max_active",
  "numeric_id",
  "permissions",
  "price",
  "probability",
  "respawn_seconds",
  "reward_gold",
  "runtime_id",
  "server_protocol",
  "spawn_rate",
]);

const FATAL_ADAPTER_DIAGNOSTICS = new Set([
  "adapter_access_error",
  "adapter_array_limit_exceeded",
  "adapter_depth_limit_exceeded",
  "adapter_key_limit_exceeded",
  "adapter_node_limit_exceeded",
]);

export interface AdapterContext {
  nodes: number;
  halted: boolean;
  readonly diagnostics: ValidationDiagnostic[];
  readonly ancestors: Set<object>;
}

type UntrustedAccess<T> = { accessible: true; value: T } | { accessible: false };

export function createAdapterContext(): AdapterContext {
  return { nodes: 0, halted: false, diagnostics: [], ancestors: new Set<object>() };
}

function accessUntrusted<T>(reader: () => T): UntrustedAccess<T> {
  try {
    return { accessible: true, value: reader() };
  } catch {
    return { accessible: false };
  }
}

export function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function sortDiagnostics(diagnostics: ValidationDiagnostic[]): ValidationDiagnostic[] {
  return diagnostics.sort(
    (left, right) =>
      compareOrdinal(left.code, right.code) ||
      compareOrdinal(left.path, right.path) ||
      compareOrdinal(left.message, right.message),
  );
}

export function hasFatalAdapterDiagnostics(
  diagnostics: readonly ValidationDiagnostic[],
  startIndex: number,
): boolean {
  for (let index = startIndex; index < diagnostics.length; index += 1) {
    const diagnostic = diagnostics[index];
    if (diagnostic !== undefined && FATAL_ADAPTER_DIAGNOSTICS.has(diagnostic.code)) return true;
  }
  return false;
}

function addDiagnostic(
  context: AdapterContext,
  code: string,
  path: string,
  message: string,
): void {
  context.diagnostics.push({ code, path, message });
}

function normalizeFieldName(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

export function isNonPortableString(value: string): boolean {
  return /(?:res|user|file):\/\//i.test(value) || /(?:^|\s)[A-Za-z]:[\\/]/.test(value) || /^\//.test(value);
}

function enterNode(path: string, context: AdapterContext, depth: number): boolean {
  if (context.halted) return false;
  if (depth > MAX_ADAPTER_DEPTH) {
    addDiagnostic(
      context,
      "adapter_depth_limit_exceeded",
      path,
      `adapter value exceeds depth ${MAX_ADAPTER_DEPTH}`,
    );
    return false;
  }
  context.nodes += 1;
  if (context.nodes > MAX_ADAPTER_NODES) {
    addDiagnostic(
      context,
      "adapter_node_limit_exceeded",
      path,
      `adapter value exceeds ${MAX_ADAPTER_NODES} nodes`,
    );
    context.halted = true;
    return false;
  }
  return true;
}

function sanitizeDraftValueInternal(
  value: unknown,
  path: string,
  context: AdapterContext,
  depth: number,
): unknown {
  if (!enterNode(path, context, depth)) return undefined;
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    addDiagnostic(context, "unsupported_adapter_value", path, "unsupported adapter value ignored");
    return undefined;
  }
  if (typeof value === "string") {
    if (value.length > MAX_ADAPTER_STRING_LENGTH) {
      addDiagnostic(
        context,
        "adapter_string_limit_exceeded",
        path,
        `adapter string must contain at most ${MAX_ADAPTER_STRING_LENGTH} characters`,
      );
      return undefined;
    }
    if (isNonPortableString(value)) {
      addDiagnostic(context, "nonportable_value_ignored", path, "nonportable value ignored");
      return undefined;
    }
    return value;
  }
  if (typeof value !== "object" || value === null) {
    addDiagnostic(context, "unsupported_adapter_value", path, "unsupported adapter value ignored");
    return undefined;
  }
  if (context.ancestors.has(value)) {
    addDiagnostic(context, "adapter_cycle_detected", path, "cyclic adapter value ignored");
    return undefined;
  }

  const arrayAccess = accessUntrusted(() => Array.isArray(value));
  if (!arrayAccess.accessible) {
    addDiagnostic(context, "adapter_access_error", path, "adapter value could not be accessed");
    return undefined;
  }
  if (arrayAccess.value) {
    const lengthAccess = accessUntrusted(() => (value as unknown[]).length);
    if (!lengthAccess.accessible || !Number.isSafeInteger(lengthAccess.value) || lengthAccess.value < 0) {
      addDiagnostic(context, "adapter_access_error", path, "adapter value could not be accessed");
      return undefined;
    }
    if (lengthAccess.value > MAX_ADAPTER_ARRAY_ITEMS) {
      addDiagnostic(
        context,
        "adapter_array_limit_exceeded",
        path,
        `adapter array must contain at most ${MAX_ADAPTER_ARRAY_ITEMS} items`,
      );
      return undefined;
    }
    context.ancestors.add(value);
    try {
      const output: unknown[] = [];
      for (let index = 0; index < lengthAccess.value; index += 1) {
        const itemPath = `${path}[${index}]`;
        const itemAccess = accessUntrusted(() => (value as unknown[])[index]);
        if (!itemAccess.accessible) {
          addDiagnostic(context, "adapter_access_error", itemPath, "adapter value could not be accessed");
          continue;
        }
        const sanitized = sanitizeDraftValueInternal(itemAccess.value, itemPath, context, depth + 1);
        if (sanitized !== undefined) output.push(sanitized);
        if (context.halted) break;
      }
      return output;
    } finally {
      context.ancestors.delete(value);
    }
  }

  const prototypeAccess = accessUntrusted(() => Object.getPrototypeOf(value));
  if (!prototypeAccess.accessible) {
    addDiagnostic(context, "adapter_access_error", path, "adapter value could not be accessed");
    return undefined;
  }
  if (prototypeAccess.value !== Object.prototype && prototypeAccess.value !== null) {
    addDiagnostic(context, "unsupported_adapter_value", path, "unsupported adapter value ignored");
    return undefined;
  }
  const keysAccess = accessUntrusted(() => Reflect.ownKeys(value));
  if (!keysAccess.accessible) {
    addDiagnostic(context, "adapter_access_error", path, "adapter value could not be accessed");
    return undefined;
  }
  if (keysAccess.value.length > MAX_ADAPTER_OWN_KEYS) {
    addDiagnostic(
      context,
      "adapter_key_limit_exceeded",
      path,
      `adapter record must contain at most ${MAX_ADAPTER_OWN_KEYS} own keys`,
    );
    return undefined;
  }
  const keys: string[] = [];
  for (let index = 0; index < keysAccess.value.length; index += 1) {
    const key = keysAccess.value[index];
    if (typeof key !== "string") {
      addDiagnostic(context, "unsupported_adapter_value", path, "symbol adapter key ignored");
      continue;
    }
    keys.push(key);
  }
  keys.sort(compareOrdinal);

  context.ancestors.add(value);
  try {
    const output = Object.create(null) as Record<string, unknown>;
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (key === undefined) continue;
      const keyPath = `${path}.${key}`;
      const normalized = normalizeFieldName(key);
      if (FORBIDDEN_AUTHORITATIVE_FIELDS.has(normalized)) {
        addDiagnostic(
          context,
          "authoritative_field_ignored",
          keyPath,
          `authoritative field ignored: ${normalized}`,
        );
        continue;
      }
      const nestedAccess = accessUntrusted(() => Reflect.get(value, key));
      if (!nestedAccess.accessible) {
        addDiagnostic(context, "adapter_access_error", keyPath, "adapter value could not be accessed");
        continue;
      }
      const sanitized = sanitizeDraftValueInternal(nestedAccess.value, keyPath, context, depth + 1);
      if (sanitized !== undefined) {
        Object.defineProperty(output, key, {
          configurable: true,
          enumerable: true,
          value: sanitized,
          writable: true,
        });
      }
      if (context.halted) break;
    }
    return output;
  } finally {
    context.ancestors.delete(value);
  }
}

export function inspectAdapterOwnKeys(
  value: object,
  path: string,
  context: AdapterContext,
  accessMessage = "adapter record could not be accessed",
): boolean {
  const keysAccess = accessUntrusted(() => Reflect.ownKeys(value));
  if (!keysAccess.accessible) {
    addDiagnostic(context, "adapter_access_error", path, accessMessage);
    return false;
  }
  if (keysAccess.value.length > MAX_ADAPTER_OWN_KEYS) {
    addDiagnostic(
      context,
      "adapter_key_limit_exceeded",
      path,
      `adapter record must contain at most ${MAX_ADAPTER_OWN_KEYS} own keys`,
    );
    return false;
  }
  return true;
}

export function sanitizeDraftValue(
  value: unknown,
  path: string,
  context: AdapterContext,
): unknown {
  return sanitizeDraftValueInternal(value, path, context, 0);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function sanitizeReferences(
  value: unknown,
  path: string,
  context: AdapterContext,
): ContentReference[] {
  if (value === undefined) return [];
  const arrayAccess = accessUntrusted(() => Array.isArray(value));
  if (!arrayAccess.accessible || !arrayAccess.value) {
    addDiagnostic(context, "invalid_adapter_reference", path, "adapter refs must be an array");
    return [];
  }
  const lengthAccess = accessUntrusted(() => (value as unknown[]).length);
  if (!lengthAccess.accessible || !Number.isSafeInteger(lengthAccess.value) || lengthAccess.value < 0) {
    addDiagnostic(context, "adapter_access_error", path, "adapter refs could not be accessed");
    return [];
  }
  if (lengthAccess.value > MAX_ADAPTER_RECORDS) {
    addDiagnostic(
      context,
      "adapter_record_limit_exceeded",
      path,
      `adapter collection must contain at most ${MAX_ADAPTER_RECORDS} records`,
    );
    return [];
  }

  const output: ContentReference[] = [];
  const signatures = new Set<string>();
  for (let index = 0; index < lengthAccess.value; index += 1) {
    const itemPath = `${path}[${index}]`;
    const itemAccess = accessUntrusted(() => (value as unknown[])[index]);
    if (!itemAccess.accessible) {
      addDiagnostic(context, "adapter_access_error", itemPath, "adapter reference could not be accessed");
      continue;
    }
    let record: Record<string, unknown>;
    try {
      if (!isPlainRecord(itemAccess.value)) {
        addDiagnostic(context, "invalid_adapter_reference", itemPath, "adapter reference requires predicate and stable target");
        continue;
      }
      record = itemAccess.value;
    } catch {
      addDiagnostic(context, "adapter_access_error", itemPath, "adapter reference could not be accessed");
      continue;
    }
    const predicateAccess = accessUntrusted(() => Reflect.get(record, "predicate"));
    const targetAccess = accessUntrusted(() => Reflect.get(record, "target"));
    const versionAccess = accessUntrusted(() => Reflect.get(record, "version"));
    if (!predicateAccess.accessible || !targetAccess.accessible || !versionAccess.accessible) {
      addDiagnostic(context, "adapter_access_error", itemPath, "adapter reference could not be accessed");
      continue;
    }
    if (
      typeof predicateAccess.value !== "string" ||
      predicateAccess.value.length === 0 ||
      typeof targetAccess.value !== "string" ||
      !CONTENT_ID_PATTERN.test(targetAccess.value) ||
      (versionAccess.value !== undefined && typeof versionAccess.value !== "string")
    ) {
      addDiagnostic(context, "invalid_adapter_reference", itemPath, "adapter reference requires predicate and stable target");
      continue;
    }
    const version = versionAccess.value as string | undefined;
    const signature = `${predicateAccess.value}\u0000${targetAccess.value}\u0000${version ?? ""}`;
    if (signatures.has(signature)) {
      addDiagnostic(context, "duplicate_adapter_reference", itemPath, "duplicate adapter reference omitted");
      continue;
    }
    signatures.add(signature);
    output.push({
      predicate: predicateAccess.value,
      target: targetAccess.value,
      ...(version === undefined ? {} : { version }),
    });
  }
  output.sort(
    (left, right) =>
      compareOrdinal(left.predicate, right.predicate) ||
      compareOrdinal(left.target, right.target) ||
      compareOrdinal(left.version ?? "", right.version ?? ""),
  );
  return output;
}

export interface DraftEntityInput {
  id: string;
  kind: ContentKind;
  version: string;
  licenseId: string;
  content: unknown;
  refs: ContentReference[];
}

export function buildDraftEntity(input: DraftEntityInput): ContentEntity<unknown> {
  return {
    schema: "uo.game-content-entity/v1",
    id: input.id,
    kind: input.kind,
    version: input.version,
    status: "draft",
    authority: "authoring-draft",
    compatibility: {
      content_graph: "1.x",
      client_core: "*",
      server_protocol: [],
    },
    license: { id: input.licenseId },
    content: input.content,
    refs: input.refs,
  };
}
