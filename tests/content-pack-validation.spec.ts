import { expect, test } from "@playwright/test";
import * as sdk from "../packages/content-sdk/src";
import type {
  ContentArtifact,
  ContentPackManifest,
  ValidationResult,
} from "../packages/content-sdk/src";

const validateContentPackManifest = Reflect.get(sdk, "validateContentPackManifest") as (
  value: unknown,
) => ValidationResult;
const isPortableArtifactPath = Reflect.get(sdk, "isPortableArtifactPath") as (
  path: string,
) => boolean;

const graphArtifact: ContentArtifact = {
  role: "graph",
  path: "content/graph.json",
  sha256: "0".repeat(64),
  media_type: "application/json",
  license: { id: "MIT" },
  provenance: { kind: "generated", source: "pack-build" },
};

const entityArtifact: ContentArtifact = {
  role: "entity",
  content_id: "realm.example.start",
  path: "content/realms/start.json",
  sha256: "1".repeat(64),
  media_type: "application/json",
  license: { id: "MIT" },
  provenance: { kind: "original", source: "tutorial-authoring" },
};

const validManifest: ContentPackManifest = {
  schema: "uo.game-content-pack/v1",
  id: "pack.example.tutorial",
  version: "1.0.0",
  status: "draft",
  visibility: "public",
  compatibility: {
    content_graph: "1.x",
    client_core: ">=0.2.0 <1.0.0",
    server_protocol: [],
  },
  artifacts: [graphArtifact, entityArtifact],
};

test("exports content-pack structural validation", () => {
  expect(typeof validateContentPackManifest).toBe("function");
  expect(typeof isPortableArtifactPath).toBe("function");
});

test("accepts a minimal separate content-pack manifest", () => {
  expect(validateContentPackManifest(validManifest)).toEqual({ valid: true, diagnostics: [] });
});

test("accepts only strict relative POSIX artifact paths", () => {
  expect(isPortableArtifactPath("content/realms/start-1.json")).toBe(true);
  for (const path of [
    "",
    "../secret.json",
    "/content/graph.json",
    "C:/content/graph.json",
    "res://content/graph.json",
    "https://example.invalid/graph.json",
    "content\\graph.json",
    "content//graph.json",
    "content/./graph.json",
    "content/%2e%2e/secret.json",
    "content/graph.json?raw=1",
    "content/graph.json#fragment",
    "content/graph file.json",
  ]) {
    expect(isPortableArtifactPath(path), path).toBe(false);
    const result = validateContentPackManifest({
      ...validManifest,
      artifacts: [{ ...graphArtifact, path }, entityArtifact],
    });
    expect(result.diagnostics.map(({ code }) => code), path).toContain("invalid_artifact_path");
  }
});

test("rejects duplicate paths and content identifiers deterministically", () => {
  expect(
    validateContentPackManifest({
      ...validManifest,
      artifacts: [
        graphArtifact,
        entityArtifact,
        {
          ...entityArtifact,
          path: entityArtifact.path,
          content_id: "realm.example.other",
        },
        {
          ...entityArtifact,
          path: "content/realms/other.json",
          content_id: entityArtifact.content_id,
        },
      ],
    }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "duplicate_artifact_path",
        path: "artifacts[2].path",
        message: "duplicate artifact path: content/realms/start.json",
      },
      {
        code: "duplicate_content_id",
        path: "artifacts[3].content_id",
        message: "duplicate content id: realm.example.start",
      },
    ],
  });
});

test("requires exactly one graph artifact", () => {
  expect(
    validateContentPackManifest({ ...validManifest, artifacts: [entityArtifact] }).diagnostics,
  ).toContainEqual({
    code: "missing_graph_artifact",
    path: "artifacts",
    message: "pack must declare exactly one graph artifact",
  });

  expect(
    validateContentPackManifest({
      ...validManifest,
      artifacts: [graphArtifact, { ...graphArtifact, path: "content/other-graph.json" }],
    }).diagnostics,
  ).toContainEqual({
    code: "duplicate_graph_artifact",
    path: "artifacts[1].role",
    message: "pack must declare exactly one graph artifact",
  });
});

test("requires content_id for entity and asset roles but forbids it for graph", () => {
  const missingEntityId = { ...entityArtifact } as Partial<ContentArtifact>;
  delete missingEntityId.content_id;

  expect(
    validateContentPackManifest({
      ...validManifest,
      artifacts: [{ ...graphArtifact, content_id: "graph.example.invalid" }, missingEntityId],
    }).diagnostics,
  ).toEqual([
    {
      code: "forbidden_content_id",
      path: "artifacts[0].content_id",
      message: "graph artifact must not declare content_id",
    },
    {
      code: "missing_content_id",
      path: "artifacts[1].content_id",
      message: "entity artifact must declare a valid content_id",
    },
  ]);
});

test("rejects malformed envelope fields independently", () => {
  const cases: Array<[string, unknown, string]> = [
    ["schema", "invalid", "invalid_pack_schema"],
    ["id", "A", "invalid_pack_id"],
    ["version", "one", "invalid_pack_version"],
    ["status", "ready", "invalid_pack_status"],
    ["visibility", "secret", "invalid_pack_visibility"],
  ];

  for (const [field, value, expectedCode] of cases) {
    const result = validateContentPackManifest({ ...validManifest, [field]: value });
    expect(result.diagnostics.map(({ code }) => code), field).toContain(expectedCode);
  }
});

test("rejects malformed compatibility fields", () => {
  const result = validateContentPackManifest({
    ...validManifest,
    compatibility: {
      content_graph: "",
      client_core: "",
      server_protocol: ["", "x".repeat(129)],
    },
  });

  expect(result.diagnostics.map(({ code }) => code)).toEqual([
    "invalid_client_core_compatibility",
    "invalid_content_graph_compatibility",
    "invalid_server_protocol",
    "invalid_server_protocol",
  ]);
});

test("rejects malformed artifact evidence and hashes", () => {
  const malformed = {
    ...entityArtifact,
    sha256: "A".repeat(64),
    media_type: "not a media type",
    license: { id: "" },
    provenance: { kind: "copied", source: "" },
  };
  const result = validateContentPackManifest({
    ...validManifest,
    artifacts: [graphArtifact, malformed],
  });

  expect(result.diagnostics.map(({ code }) => code)).toEqual([
    "invalid_artifact_license",
    "invalid_artifact_media_type",
    "invalid_artifact_provenance_kind",
    "invalid_artifact_provenance_source",
    "invalid_artifact_sha256",
  ]);
});

test("rejects unknown own keys at every manifest envelope level", () => {
  const result = validateContentPackManifest({
    ...validManifest,
    ignored: true,
    compatibility: { ...validManifest.compatibility, ignored: true },
    artifacts: [
      {
        ...graphArtifact,
        ignored: true,
        license: { ...graphArtifact.license, ignored: true },
        provenance: { ...graphArtifact.provenance, ignored: true },
      },
      entityArtifact,
    ],
  });

  expect(result.diagnostics.map(({ code }) => code)).toEqual([
    "unknown_artifact_key",
    "unknown_compatibility_key",
    "unknown_license_key",
    "unknown_pack_key",
    "unknown_provenance_key",
  ]);
});

test("rejects inherited manifest and artifact envelopes", () => {
  const inheritedPack = Object.create(validManifest) as ContentPackManifest;
  const inheritedArtifact = Object.create(graphArtifact) as ContentArtifact;

  expect(validateContentPackManifest(inheritedPack)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_pack",
        path: "",
        message: "pack must be a non-null object",
      },
    ],
  });
  expect(
    validateContentPackManifest({ ...validManifest, artifacts: [inheritedArtifact] }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_artifact",
        path: "artifacts[0]",
        message: "artifact must be an object",
      },
      {
        code: "missing_graph_artifact",
        path: "artifacts",
        message: "pack must declare exactly one graph artifact",
      },
    ],
  });
});

test("caps diagnostics for a pack with 70,000 own keys", { timeout: 1_000 }, () => {
  const oversized = { ...validManifest } as ContentPackManifest & Record<string, unknown>;
  for (let index = 0; index < 70_000; index += 1) {
    oversized[`unknown_${index.toString().padStart(5, "0")}`] = index;
  }

  expect(validateContentPackManifest(oversized)).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "pack_key_limit_exceeded",
        path: "$",
        message: "pack must contain at most 64 own keys",
      },
    ],
  });
});

test("emits only one limit diagnostic for an oversized artifact record", { timeout: 1_000 }, () => {
  const oversizedArtifact = { ...graphArtifact } as ContentArtifact & Record<string, unknown>;
  for (let index = 0; index < 70_000; index += 1) {
    oversizedArtifact[`unknown_${index.toString().padStart(5, "0")}`] = index;
  }

  expect(
    validateContentPackManifest({ ...validManifest, artifacts: [oversizedArtifact] }),
  ).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "artifact_key_limit_exceeded",
        path: "artifacts[0]",
        message: "record must contain at most 16 own keys",
      },
    ],
  });
});

test("bounds oversized artifact collections before iteration", { timeout: 1_000 }, () => {
  const artifacts = Array.from({ length: 16_385 }, () => graphArtifact);
  expect(validateContentPackManifest({ ...validManifest, artifacts })).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "artifact_limit_exceeded",
        path: "artifacts",
        message: "pack must contain at most 16384 artifacts",
      },
    ],
  });
});

test("fails closed when ownKeys traps throw", { timeout: 500 }, () => {
  const hostilePack = new Proxy(validManifest, {
    ownKeys() {
      throw new Error("hostile pack ownKeys");
    },
  });
  const hostileArtifact = new Proxy(graphArtifact, {
    ownKeys() {
      throw new Error("hostile artifact ownKeys");
    },
  });

  for (const value of [hostilePack, { ...validManifest, artifacts: [hostileArtifact] }]) {
    expect(() => validateContentPackManifest(value)).not.toThrow();
    expect(validateContentPackManifest(value)).toEqual({
      valid: false,
      diagnostics: [
        {
          code: "invalid_pack_access",
          path: "$",
          message: "Pack properties could not be read",
        },
      ],
    });
  }
});

test("fails closed on an infinite artifact length without iteration", { timeout: 500 }, () => {
  const artifacts = new Proxy([], {
    get(target, property, receiver) {
      if (property === "length") return Number.POSITIVE_INFINITY;
      if (property === Symbol.iterator || property === "map") {
        throw new Error("untrusted array dispatch");
      }
      return Reflect.get(target, property, receiver);
    },
  });

  expect(validateContentPackManifest({ ...validManifest, artifacts })).toEqual({
    valid: false,
    diagnostics: [
      {
        code: "invalid_pack_access",
        path: "$",
        message: "Pack properties could not be read",
      },
    ],
  });
});

test("snapshots top-level own keys and artifact length once", { timeout: 500 }, () => {
  let ownKeyReads = 0;
  let lengthReads = 0;
  const singleUseArtifacts = new Proxy([graphArtifact, entityArtifact], {
    get(target, property, receiver) {
      if (property === "length" && ++lengthReads > 1) throw new Error("length read twice");
      return Reflect.get(target, property, receiver);
    },
  });
  const singleUsePack = new Proxy(
    { ...validManifest, artifacts: singleUseArtifacts },
    {
      ownKeys(target) {
        if (++ownKeyReads > 1) throw new Error("ownKeys read twice");
        return Reflect.ownKeys(target);
      },
    },
  );

  expect(validateContentPackManifest(singleUsePack)).toEqual({ valid: true, diagnostics: [] });
  expect(ownKeyReads).toBe(1);
  expect(lengthReads).toBe(1);
});
