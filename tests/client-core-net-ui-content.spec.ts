import { expect, test } from "@playwright/test";
import * as THREE from "three";
import * as core from "../packages/client-core/src";
import type { GameContentGraph } from "@ultod/content-sdk";

test("exports protocol and network client", () => {
  expect(core.MSG.HANDSHAKE_REQUEST).toBe(1);
  expect(typeof core.encodeMessage).toBe("function");
  expect(typeof core.decodeMessage).toBe("function");
  expect(typeof core.encodeMovement).toBe("function");
  expect(typeof core.decodePositionUpdate).toBe("function");
  expect(typeof core.NetworkClient).toBe("function");
});

test("exports UI components HudOverlay and DialogBox", () => {
  expect(typeof core.HudOverlay).toBe("function");
  expect(typeof core.DialogBox).toBe("function");
});

test("exports ContentPackLoader and mounts graph entities into scene", () => {
  expect(typeof core.ContentPackLoader).toBe("function");

  const graph: GameContentGraph = {
    schema: "uo.game-content-graph/v1",
    id: "graph.test.mount",
    version: "1.0.0",
    visibility: "public",
    roots: ["realm.test.start"],
    entities: [
      {
        schema: "uo.game-content-entity/v1",
        id: "realm.test.start",
        kind: "realm",
        version: "1.0.0",
        status: "published",
        authority: "server",
        compatibility: { content_graph: "1.x", client_core: ">=0.1.0", server_protocol: [] },
        license: { id: "MIT" },
        content: { name: "Test Realm" },
        refs: [],
      },
    ],
  };

  const scene = new THREE.Scene();
  const loader = new core.ContentPackLoader();
  const mounted = loader.mount(graph, scene);

  expect(mounted.get('realm.test.start')).toBeDefined();
  expect(scene.children.length).toBeGreaterThan(0);

  loader.unmount(scene);
  expect(loader.getMountedEntities().size).toBe(0);
});
