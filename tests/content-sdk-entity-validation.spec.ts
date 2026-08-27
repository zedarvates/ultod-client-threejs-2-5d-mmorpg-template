import { expect, test } from "@playwright/test";
import { validateEntity } from "../packages/content-sdk/src";

const validRealm = {
  schema: "uo.game-content-entity/v1",
  id: "realm.tutorial.start",
  kind: "realm",
  version: "1.0.0",
  status: "draft",
  authority: "server",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: [],
  },
  license: { id: "MIT" },
  content: { name: "Tutorial Realm" },
  refs: [],
};

test("accepts a valid realm envelope", () => {
  expect(validateEntity(validRealm)).toEqual({ valid: true, diagnostics: [] });
});

test("reports literal diagnostics for each invalid envelope field deterministically", () => {
  const result = validateEntity({
    ...validRealm,
    id: "A",
    kind: "unknown",
    version: "1.0",
    authority: "peer",
    license: {},
    refs: [
      { predicate: "contains", target: "region.tutorial" },
      { predicate: "contains", target: "region.tutorial" },
    ],
  });

  expect(result).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "duplicate_reference",
        path: "refs[1]",
        message: "duplicate reference predicate and target",
      },
      {
        code: "invalid_authority",
        path: "authority",
        message: "authority must be server, client-presentation, or authoring-draft",
      },
      {
        code: "invalid_id",
        path: "id",
        message: "id must match /^[a-z0-9][a-z0-9._-]{2,127}$/",
      },
      {
        code: "invalid_kind",
        path: "kind",
        message: "kind must be a supported content kind",
      },
      {
        code: "invalid_version",
        path: "version",
        message: "version must be a semantic version",
      },
      {
        code: "missing_license_id",
        path: "license.id",
        message: "license.id must be a non-empty string",
      },
    ],
  });
});

test("returns a literal diagnostic when an entity getter throws", () => {
  const entityWithThrowingGetter = new Proxy(
    {},
    {
      get() {
        throw new Error("untrusted getter");
      },
    },
  );

  expect(() => validateEntity(entityWithThrowingGetter)).not.toThrow();
  expect(validateEntity(entityWithThrowingGetter)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_record_access",
        path: "$",
        message: "Entity properties could not be read",
      },
    ],
  });
});

test("returns a literal diagnostic when refs reports an infinite length", { timeout: 500 }, () => {
  const refsWithInfiniteLength = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") {
        return Infinity;
      }
      return Reflect.get(target, property, receiver);
    },
  });

  const entity = { ...validRealm, refs: refsWithInfiniteLength };
  expect(() => validateEntity(entity)).not.toThrow();
  expect(validateEntity(entity)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_record_access",
        path: "$",
        message: "Entity properties could not be read",
      },
    ],
  });
});

test("returns diagnostics instead of throwing for malformed input", () => {
  expect(() => validateEntity(null)).not.toThrow();
  expect(validateEntity(null)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_entity",
        path: "",
        message: "entity must be a non-null object",
      },
    ],
  });
});
