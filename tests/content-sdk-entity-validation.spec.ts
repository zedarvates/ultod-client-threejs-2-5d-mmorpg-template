import { expect, test } from "@playwright/test";
import {
  CONTENT_KINDS,
  validateEntity,
} from "../packages/content-sdk/src";

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

test("reports literal diagnostics for every missing required envelope field", () => {
  expect(validateEntity({})).toEqual({
    valid: false,
    diagnostics: [
      { code: "invalid_authority", path: "authority", message: "authority must be server, client-presentation, or authoring-draft" },
      { code: "invalid_compatibility", path: "compatibility", message: "compatibility must be an object" },
      { code: "invalid_entity_schema", path: "schema", message: "schema must be uo.game-content-entity/v1" },
      { code: "invalid_id", path: "id", message: "id must match /^[a-z0-9][a-z0-9._-]{2,127}$/" },
      { code: "invalid_kind", path: "kind", message: "kind must be a supported content kind" },
      { code: "invalid_references", path: "refs", message: "refs must be an array" },
      { code: "invalid_status", path: "status", message: "status must be draft, published, or deprecated" },
      { code: "invalid_version", path: "version", message: "version must be a semantic version" },
      { code: "missing_content", path: "content", message: "content must be an own property" },
      { code: "missing_license_id", path: "license.id", message: "license.id must be a non-empty string" },
    ],
  });
});

test("reports literal diagnostics for invalid schema, status, and compatibility fields", () => {
  expect(validateEntity({
    ...validRealm,
    schema: "uo.game-content-entity/v2",
    status: "retired",
    compatibility: {
      content_graph: "",
      client_core: "x".repeat(257),
      server_protocol: [
        "",
        "x".repeat(129),
        ...Array.from({ length: 63 }, () => "1"),
      ],
    },
  })).toEqual({
    valid: false,
    diagnostics: [
      { code: "invalid_client_core_compatibility", path: "compatibility.client_core", message: "compatibility.client_core must be a non-empty string of at most 256 characters" },
      { code: "invalid_content_graph_compatibility", path: "compatibility.content_graph", message: "compatibility.content_graph must be a non-empty string of at most 256 characters" },
      { code: "invalid_entity_schema", path: "schema", message: "schema must be uo.game-content-entity/v1" },
      { code: "invalid_server_protocol", path: "compatibility.server_protocol[0]", message: "server protocol must be a non-empty string of at most 128 characters" },
      { code: "invalid_server_protocol", path: "compatibility.server_protocol[1]", message: "server protocol must be a non-empty string of at most 128 characters" },
      { code: "invalid_server_protocols", path: "compatibility.server_protocol", message: "compatibility.server_protocol must contain at most 64 items" },
      { code: "invalid_status", path: "status", message: "status must be draft, published, or deprecated" },
    ],
  });
});

test("requires content to be an own property", () => {
  const inheritedContent = Object.create({ content: { inherited: true } }) as Record<string, unknown>;
  Object.assign(inheritedContent, validRealm);
  delete inheritedContent.content;

  expect(validateEntity(inheritedContent)).toEqual({
    valid: false,
    diagnostics: [
      { code: "missing_content", path: "content", message: "content must be an own property" },
    ],
  });
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

test("freezes runtime kinds so mutation cannot expand accepted entity kinds", () => {
  expect(Object.isFrozen(CONTENT_KINDS)).toBe(true);

  const mutableKinds = CONTENT_KINDS as unknown as string[];
  expect(() => mutableKinds.push("unsupported-kind")).toThrow(TypeError);
  expect(validateEntity({ ...validRealm, kind: "unsupported-kind" })).toMatchObject({
    valid: false,
    diagnostics: [
      {
        code: "invalid_kind",
        path: "kind",
        message: "kind must be a supported content kind",
      },
    ],
  });
});
