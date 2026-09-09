import {
  MAX_MANIFEST_ARRAY_ITEMS,
  MAX_MANIFEST_DEPTH,
  MAX_MANIFEST_NODES,
  MAX_MANIFEST_OWN_KEYS,
  MAX_MANIFEST_STRING_LENGTH,
} from "./limits.js";
import type { GameManifestDiagnostic } from "./types.js";

export type SnapshotResult =
  | { ok: true; value: unknown }
  | { ok: false; diagnostic: GameManifestDiagnostic };

function escapedPointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function childPath(parent: string, key: string | number): string {
  return parent === "/" ? `/${escapedPointerToken(String(key))}` : `${parent}/${escapedPointerToken(String(key))}`;
}

function limit(path: string, detail: string): SnapshotResult {
  return { ok: false, diagnostic: { path, code: "manifest_limit_exceeded", detail } };
}

function accessFailure(path: string, code = "invalid_manifest_access"): SnapshotResult {
  return { ok: false, diagnostic: { path, code } };
}

function exceedsScalarLimit(value: string): boolean {
  let count = 0;
  for (const _scalar of value) {
    count += 1;
    if (count > MAX_MANIFEST_STRING_LENGTH) return true;
  }
  return false;
}

export function snapshotUnknown(input: unknown): SnapshotResult {
  let nodes = 0;
  const active = new WeakSet<object>();

  const visit = (value: unknown, path: string, depth: number): SnapshotResult => {
    if (depth > MAX_MANIFEST_DEPTH) return limit(path, "depth");
    nodes += 1;
    if (nodes > MAX_MANIFEST_NODES) return limit(path, "nodes");

    if (typeof value === "string") {
      if (exceedsScalarLimit(value)) return limit(path, "string_length");
      return { ok: true, value };
    }
    if (value === null || value === undefined || typeof value === "boolean") return { ok: true, value };
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? { ok: true, value }
        : accessFailure(path, "unsupported_manifest_value");
    }
    if (typeof value !== "object") return accessFailure(path, "unsupported_manifest_value");

    const object = value as object;
    if (active.has(object)) return accessFailure(path, "invalid_manifest_cycle");
    active.add(object);

    let isArray: boolean;
    try {
      isArray = Array.isArray(object);
    } catch {
      active.delete(object);
      return accessFailure(path);
    }

    if (isArray) {
      let length: unknown;
      try {
        length = Reflect.get(object, "length");
      } catch {
        active.delete(object);
        return accessFailure(path);
      }
      if (!Number.isSafeInteger(length) || (length as number) < 0 || (length as number) > MAX_MANIFEST_ARRAY_ITEMS) {
        active.delete(object);
        return limit(path, "array_items");
      }

      let keys: (string | symbol)[];
      try {
        keys = Reflect.ownKeys(object);
      } catch {
        active.delete(object);
        return accessFailure(path);
      }
      const expectedKeys = new Set(["length", ...Array.from({ length: length as number }, (_, index) => String(index))]);
      const extraKeys = keys.filter((key) => typeof key !== "string" || !expectedKeys.has(key));
      if (extraKeys.length > MAX_MANIFEST_OWN_KEYS) {
        active.delete(object);
        return limit(path, "own_keys");
      }
      if (extraKeys.length > 0) {
        active.delete(object);
        return accessFailure(path);
      }

      const snapshot: unknown[] = [];
      for (let index = 0; index < (length as number); index += 1) {
        let descriptor: PropertyDescriptor | undefined;
        try {
          descriptor = Reflect.getOwnPropertyDescriptor(object, String(index));
        } catch {
          active.delete(object);
          return accessFailure(childPath(path, index));
        }
        if (!descriptor || !("value" in descriptor)) {
          active.delete(object);
          return accessFailure(childPath(path, index));
        }
        const child = visit(descriptor.value, childPath(path, index), depth + 1);
        if (!child.ok) {
          active.delete(object);
          return child;
        }
        snapshot.push(child.value);
      }
      active.delete(object);
      return { ok: true, value: snapshot };
    }

    let keys: (string | symbol)[];
    try {
      keys = Reflect.ownKeys(object);
    } catch {
      active.delete(object);
      return accessFailure(path);
    }
    if (keys.length > MAX_MANIFEST_OWN_KEYS) {
      active.delete(object);
      return limit(path, "own_keys");
    }
    if (keys.some((key) => typeof key !== "string")) {
      active.delete(object);
      return accessFailure(path);
    }

    const snapshot: Record<string, unknown> = {};
    for (const key of keys as string[]) {
      let descriptor: PropertyDescriptor | undefined;
      try {
        descriptor = Reflect.getOwnPropertyDescriptor(object, key);
      } catch {
        active.delete(object);
        return accessFailure(childPath(path, key));
      }
      if (!descriptor || !("value" in descriptor)) {
        active.delete(object);
        return accessFailure(childPath(path, key));
      }
      const child = visit(descriptor.value, childPath(path, key), depth + 1);
      if (!child.ok) {
        active.delete(object);
        return child;
      }
      Object.defineProperty(snapshot, key, {
        value: child.value,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    active.delete(object);
    return { ok: true, value: snapshot };
  };

  return visit(input, "/", 0);
}
