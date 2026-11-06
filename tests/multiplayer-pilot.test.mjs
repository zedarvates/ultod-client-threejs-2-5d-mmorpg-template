// SPDX-License-Identifier: MIT
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { assessMultiplayerPilot, CRITERIA } from "../scripts/check-multiplayer-pilot.mjs";

const revisions = { server: "1".repeat(40), client: "2".repeat(40) };
// Authored test data, never a recorded or attested runtime execution.
function authoredTrace() {
  const events = [
    { kind: "login", source: "server", client: "A", playerId: "pa", sessionId: "sa" },
    { kind: "login", source: "server", client: "B", playerId: "pb", sessionId: "sb" },
    { kind: "spawn", source: "server", client: "A", playerId: "pa", sessionId: "sa", entityId: "ea", position: [0, 0, 0] },
    { kind: "spawn", source: "server", client: "B", playerId: "pb", sessionId: "sb", entityId: "eb", position: [0, 0, 1] },
    { kind: "movement", source: "server", client: "A", entityId: "ea", moveId: "ma", tick: 100, position: [1, 0, 2] },
    { kind: "movement", source: "client:B", client: "A", entityId: "ea", moveId: "ma", tick: 100, position: [1, 0, 2] },
    { kind: "movement", source: "server", client: "B", entityId: "eb", moveId: "mb", tick: 101, position: [-1, 0, 1] },
    { kind: "movement", source: "client:A", client: "B", entityId: "eb", moveId: "mb", tick: 101, position: [-1, 0, 1] },
    { kind: "npc", source: "server", client: "A", entityId: "ea", npcId: "guide", interactionId: "ia", resultId: "dialogue-1" },
    { kind: "npc", source: "client:A", client: "A", entityId: "ea", npcId: "guide", interactionId: "ia", resultId: "dialogue-1" },
    { kind: "disconnect", source: "server", client: "A", entityId: "ea", sessionId: "sa" },
    { kind: "resume", source: "server", client: "A", playerId: "pa", entityId: "ea", previousSessionId: "sa", sessionId: "sa2", tick: 102, position: [1, 0, 2] },
    { kind: "resume", source: "client:A", client: "A", playerId: "pa", entityId: "ea", previousSessionId: "sa", sessionId: "sa2", tick: 102, position: [1, 0, 2] },
    ...["server", "client:A", "client:B"].map((source) => ({ kind: "snapshot", source, entities: [{ playerId: "pa", entityId: "ea", sessionId: "sa2", position: [1, 0, 2] }, { playerId: "pb", entityId: "eb", sessionId: "sb", position: [-1, 0, 1] }] })),
  ];
  return { schema: "uo.multiplayer-pilot-trace/v1", runId: "authored-test", mode: "canonical_runtime", revisions: { ...revisions }, events };
}
const check = (trace) => assessMultiplayerPilot(trace, revisions);
const criterion = (report, name) => report.criteria.find((item) => item.id === name);

test("complete supplied observations become reviewable, never runtime verified", () => {
  const report = check(authoredTrace());
  assert.equal(report.status, "ready_for_review");
  assert.equal(report.runtime_verified, false);
  assert.deepEqual(report.criteria.map((item) => item.id), CRITERIA);
  assert.ok(report.criteria.every((item) => item.status === "passed" && item.evidenceRefs.length > 0));
});

test("a synthetic fixture cannot qualify canonical runtime", () => {
  const trace = authoredTrace(); trace.mode = "synthetic";
  assert.equal(check(trace).status, "blocked");
  assert.ok(check(trace).criteria.every((item) => item.code === "synthetic_only"));
});

test("six success booleans are not observations", () => {
  const trace = authoredTrace(); trace.events = CRITERIA.map((name) => ({ kind: name, success: true }));
  assert.equal(check(trace).status, "failed");
});

test("prototype names are invalid kinds, never uncaught parser exceptions", () => {
  for (const kind of ["constructor", "__proto__", "toString", null, 1]) {
    const trace = authoredTrace(); trace.events = [{ kind }];
    assert.equal(check(trace).status, "failed");
  }
});

test("same player in two windows is not two authenticated clients", () => {
  const trace = authoredTrace(); trace.events[1].playerId = "pa";
  assert.equal(criterion(check(trace), "connexion").status, "failed");
});

test("a movement echoed back to the sending client does not prove synchronization", () => {
  const trace = authoredTrace(); trace.events[5].source = "client:A";
  assert.equal(criterion(check(trace), "synchronisation").status, "blocked");
});

test("peer must see the exact accepted entity, position and tick", () => {
  for (const [key, value] of [["entityId", "unrelated"], ["position", [1, 0, 99]], ["tick", 99]]) {
    const trace = authoredTrace(); trace.events[5][key] = value;
    assert.equal(criterion(check(trace), "synchronisation").status, "failed");
  }
});

test("unchanged spawn coordinates do not prove movement", () => {
  const trace = authoredTrace(); trace.events[4].position = [0, 0, 0];
  assert.equal(criterion(check(trace), "mouvement").status, "failed");
});

test("local NPC dialogue without matching server result remains blocked", () => {
  const trace = authoredTrace(); trace.events.splice(8, 1);
  assert.equal(criterion(check(trace), "pnj").status, "blocked");
});

test("different NPC response or actor fails", () => {
  for (const key of ["resultId", "entityId", "npcId", "interactionId"]) {
    const trace = authoredTrace(); trace.events[9][key] = "wrong";
    assert.equal(criterion(check(trace), "pnj").status, "failed");
  }
});

test("reconnection rejects a new entity, an old session and a lost peer", () => {
  for (const mutate of [
    (trace) => { trace.events[11].entityId = "new-entity"; },
    (trace) => { trace.events[11].sessionId = "sa"; },
    (trace) => { trace.events[13].entities.pop(); },
  ]) {
    const trace = authoredTrace(); mutate(trace);
    assert.equal(criterion(check(trace), "reconnexion").status, "failed");
  }
});

test("every post-resume snapshot must be unique, even after one good snapshot", () => {
  const trace = authoredTrace();
  const duplicate = structuredClone(trace.events[15]);
  duplicate.entities.push({ playerId: "pa", entityId: "ghost", sessionId: "sa", position: [1, 0, 2] });
  trace.events.push(duplicate);
  assert.equal(criterion(check(trace), "reconnexion").status, "failed");
});

test("missing peer snapshot cannot establish reconnect uniqueness", () => {
  const trace = authoredTrace(); trace.events.pop();
  assert.equal(criterion(check(trace), "reconnexion").status, "blocked");
});

test("server and peer success without a client A resume cannot qualify reconnection", () => {
  const trace = authoredTrace(); trace.events.splice(12, 1);
  assert.equal(criterion(check(trace), "reconnexion").status, "blocked");
});

test("client A must receive matching resumed session, identity, tick and position", () => {
  for (const [key, value] of [["sessionId", "sa"], ["entityId", "lost-entity"], ["playerId", "other"], ["previousSessionId", "other"], ["position", [99, 0, 99]], ["tick", 99]]) {
    const trace = authoredTrace(); trace.events[12][key] = value;
    assert.equal(criterion(check(trace), "reconnexion").status, "failed");
  }
});

test("client A needs a post-resume snapshot with the preserved state", () => {
  const absent = authoredTrace(); absent.events.splice(14, 1);
  assert.equal(criterion(check(absent), "reconnexion").status, "blocked");
  const wrong = authoredTrace(); wrong.events[14].entities[0].position = [0, 0, 0];
  assert.equal(criterion(check(wrong), "reconnexion").status, "failed");
});

test("a delayed NPC result after disconnect does not prove the ordered journey", () => {
  const trace = authoredTrace();
  trace.events.push(trace.events.splice(9, 1)[0]);
  assert.equal(criterion(check(trace), "reconnexion").status, "failed");
});

test("revisions must match caller pins and numeric observations must be finite", () => {
  const trace = authoredTrace(); trace.revisions.server = "3".repeat(40);
  assert.equal(check(trace).status, "failed");
  assert.equal(assessMultiplayerPilot(authoredTrace(), {}).status, "failed");
  const invalid = authoredTrace(); invalid.events[4].position[0] = Number.NaN;
  assert.equal(check(invalid).status, "failed");
});

test("CLI produces blocked exit 2 and a machine-readable domain report", async () => {
  const directory = await mkdtemp(join(tmpdir(), "uo-pilot-test-"));
  try {
    const trace = authoredTrace(); trace.mode = "blocked"; trace.events = [];
    const path = join(directory, "trace.json"); await writeFile(path, JSON.stringify(trace));
    const result = spawnSync(process.execPath, ["scripts/check-multiplayer-pilot.mjs", path, "--server-revision", revisions.server, "--client-revision", revisions.client], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.equal(JSON.parse(result.stdout).status, "blocked");
    assert.equal(JSON.parse(result.stdout).runtime_verified, false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
