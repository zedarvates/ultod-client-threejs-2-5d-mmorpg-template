// SPDX-License-Identifier: MIT
// Domain checks over supplied observations. This is not a runtime attestation.
import { readFile, lstat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const CRITERIA = ["connexion", "spawn", "mouvement", "pnj", "synchronisation", "reconnexion"];
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const id = (value) => typeof value === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(value);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const samePosition = (a, b) => a.every((value, index) => value === b[index]);
const position = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const fields = {
  login: ["kind", "source", "client", "playerId", "sessionId"],
  spawn: ["kind", "source", "client", "playerId", "sessionId", "entityId", "position"],
  movement: ["kind", "source", "client", "entityId", "moveId", "tick", "position"],
  npc: ["kind", "source", "client", "entityId", "npcId", "interactionId", "resultId"],
  disconnect: ["kind", "source", "client", "sessionId", "entityId"],
  resume: ["kind", "source", "client", "playerId", "sessionId", "previousSessionId", "entityId", "tick", "position"],
  snapshot: ["kind", "source", "entities"],
};

function validEvent(event) {
  if (!object(event) || typeof event.kind !== "string" || !Object.hasOwn(fields, event.kind) || Object.keys(event).length !== fields[event.kind].length ||
      !Object.keys(event).every((key) => fields[event.kind].includes(key))) return false;
  if (!["server", "client:A", "client:B"].includes(event.source)) return false;
  if (event.kind === "snapshot") {
    return Array.isArray(event.entities) && event.entities.length <= 1024 && event.entities.every((entity) =>
      object(entity) && Object.keys(entity).length === 4 &&
      ["playerId", "sessionId", "entityId"].every((key) => id(entity[key])) && position(entity.position));
  }
  if (!["A", "B"].includes(event.client)) return false;
  return fields[event.kind].every((key) => {
    if (["kind", "source", "client"].includes(key)) return true;
    if (key === "position") return position(event[key]);
    if (key === "tick") return Number.isSafeInteger(event[key]) && event[key] >= 0;
    return id(event[key]);
  });
}

export function assessMultiplayerPilot(trace, expected) {
  const report = {
    schema: "uo.multiplayer-pilot-check/v1",
    status: "blocked",
    runtime_verified: false,
    trust: "consistency_of_supplied_observations_only",
    criteria: CRITERIA.map((criterion) => ({ id: criterion, status: "blocked", code: "missing_observations", evidenceRefs: [] })),
  };
  const failAll = (code) => {
    report.status = "failed";
    report.criteria = CRITERIA.map((criterion) => ({ id: criterion, status: "failed", code, evidenceRefs: [] }));
    return report;
  };
  if (!object(trace) || trace.schema !== "uo.multiplayer-pilot-trace/v1" ||
      Object.keys(trace).length !== 5 || !["schema", "runId", "mode", "revisions", "events"].every((key) => key in trace) ||
      !id(trace.runId) || !["canonical_runtime", "synthetic", "blocked"].includes(trace.mode)) return failAll("invalid_trace");
  if (!object(expected) || !sha(expected.server) || !sha(expected.client)) return failAll("expected_revisions_required");
  if (!object(trace.revisions) || Object.keys(trace.revisions).length !== 2 ||
      trace.revisions.server !== expected.server || trace.revisions.client !== expected.client) return failAll("revision_mismatch");
  if (!Array.isArray(trace.events) || trace.events.length > 4096 || !trace.events.every(validEvent)) return failAll("invalid_observations");
  if (trace.mode !== "canonical_runtime") {
    report.criteria.forEach((criterion) => { criterion.code = trace.mode === "synthetic" ? "synthetic_only" : "runtime_unavailable"; });
    return report;
  }
  const events = trace.events;
  const find = (kind, source, client) => events.flatMap((event, index) =>
    event.kind === kind && event.source === source && (client === undefined || event.client === client) ? [{ event, index }] : []);
  const record = (criterion, status, code, observations = []) => {
    const target = report.criteria.find((item) => item.id === criterion);
    Object.assign(target, { status, code, evidenceRefs: observations.map(({ index }) => `trace:#/events/${index}`) });
  };
  const exactPair = (kind) => {
    const pair = [find(kind, "server", "A"), find(kind, "server", "B")];
    return pair.every((items) => items.length === 1) ? pair.map(([item]) => item) : null;
  };
  const logins = exactPair("login");
  if (logins) record("connexion", logins[0].event.playerId !== logins[1].event.playerId && logins[0].event.sessionId !== logins[1].event.sessionId ? "passed" : "failed", "distinct_authenticated_identities", logins);
  else if (find("login", "server", "A").length > 1 || find("login", "server", "B").length > 1) record("connexion", "failed", "ambiguous_login");
  const spawns = exactPair("spawn");
  if (spawns && logins) {
    const matching = spawns.every(({ event, index }, i) => index > logins[i].index && event.playerId === logins[i].event.playerId && event.sessionId === logins[i].event.sessionId);
    record("spawn", matching && spawns[0].event.entityId !== spawns[1].event.entityId ? "passed" : "failed", "distinct_server_entities", spawns);
  }
  const moves = exactPair("movement");
  if (moves && spawns) {
    const matching = moves.every(({ event, index }, i) => index > spawns[i].index && event.entityId === spawns[i].event.entityId && !samePosition(event.position, spawns[i].event.position));
    record("mouvement", matching && moves[0].event.moveId !== moves[1].event.moveId ? "passed" : "failed", "server_accepted_movements", moves);
    const observed = [find("movement", "client:B", "A"), find("movement", "client:A", "B")];
    if (observed.every((items) => items.length === 1)) {
      const peers = observed.map(([item]) => item);
      const same = peers.every(({ event, index }, i) => index > moves[i].index && event.entityId === moves[i].event.entityId && event.moveId === moves[i].event.moveId && event.tick === moves[i].event.tick && samePosition(event.position, moves[i].event.position));
      record("synchronisation", same ? "passed" : "failed", "reciprocal_server_state", [...moves, ...peers]);
    } else if (observed.some((items) => items.length > 1)) record("synchronisation", "failed", "ambiguous_peer_observation");
  }
  const npcServer = find("npc", "server", "A");
  const npcClient = find("npc", "client:A", "A");
  if (npcServer.length === 1 && npcClient.length === 1 && spawns && moves) {
    const authoritative = npcServer[0]; const observed = npcClient[0];
    const same = ["entityId", "npcId", "interactionId", "resultId"].every((key) => authoritative.event[key] === observed.event[key]);
    record("pnj", same && authoritative.event.entityId === spawns[0].event.entityId && authoritative.event.npcId !== authoritative.event.entityId && authoritative.index > moves[0].index && observed.index > authoritative.index ? "passed" : "failed", "server_npc_result", [...npcServer, ...npcClient]);
  }
  const disconnects = find("disconnect", "server", "A");
  const resumes = find("resume", "server", "A");
  const clientResumes = find("resume", "client:A", "A");
  if (disconnects.length === 1 && resumes.length === 1 && clientResumes.length === 1 && logins && spawns && moves && npcServer.length === 1) {
    const disconnected = disconnects[0]; const resumed = resumes[0];
    const clientResumed = clientResumes[0];
    const prior = logins[0].event; const current = resumed.event;
    const snapshots = ["server", "client:A", "client:B"].map((source) => find("snapshot", source).filter(({ index }) => index > (source === "client:A" ? clientResumed.index : resumed.index)));
    if (snapshots.every((items) => items.length >= 1)) {
      const preDisconnectMovements = find("movement", "client:B", "A").concat(find("movement", "client:A", "B"));
      const preserved = npcClient.length === 1 && disconnected.index > npcClient[0].index &&
        moves !== null && moves.every(({ index }) => index < disconnected.index) &&
        preDisconnectMovements.length === 2 && preDisconnectMovements.every(({ index }) => index < disconnected.index) &&
        disconnected.index > npcServer[0].index && resumed.index > disconnected.index &&
        disconnected.event.entityId === spawns[0].event.entityId && disconnected.event.sessionId === prior.sessionId &&
        current.playerId === prior.playerId && current.previousSessionId === prior.sessionId && current.sessionId !== prior.sessionId && current.sessionId !== logins[1].event.sessionId && current.entityId === spawns[0].event.entityId &&
        current.tick >= moves[0].event.tick && samePosition(current.position, moves[0].event.position) &&
        clientResumed.index > resumed.index && ["playerId", "entityId", "previousSessionId", "sessionId", "tick"].every((key) => clientResumed.event[key] === current[key]) && samePosition(clientResumed.event.position, current.position);
      const unique = snapshots.flat().every(({ event }) => {
        const a = event.entities.filter((entity) => entity.playerId === prior.playerId || entity.entityId === current.entityId);
        const b = event.entities.filter((entity) => entity.playerId === logins[1].event.playerId || entity.entityId === spawns[1].event.entityId);
        return a.length === 1 && a[0].playerId === prior.playerId && a[0].entityId === current.entityId && a[0].sessionId === current.sessionId && samePosition(a[0].position, current.position) &&
          b.length === 1 && b[0].playerId === logins[1].event.playerId && b[0].entityId === spawns[1].event.entityId && b[0].sessionId === logins[1].event.sessionId && samePosition(b[0].position, moves[1].event.position);
      });
      record("reconnexion", preserved && unique ? "passed" : "failed", "identity_preserved_without_duplicate", [...disconnects, ...resumes, ...clientResumes, ...snapshots.flat()]);
    }
  }
  report.status = report.criteria.some((item) => item.status === "failed") ? "failed" : report.criteria.every((item) => item.status === "passed") ? "ready_for_review" : "blocked";
  return report;
}

export async function main(args) {
  if (args.length !== 5 || args[1] !== "--server-revision" || args[3] !== "--client-revision") {
    process.stderr.write("Usage: node scripts/check-multiplayer-pilot.mjs TRACE.json --server-revision SHA --client-revision SHA\n");
    return 2;
  }
  try {
    const info = await lstat(args[0]);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 1_048_576) throw new Error("invalid_file");
    const trace = JSON.parse(await readFile(args[0], "utf8"));
    const report = assessMultiplayerPilot(trace, { server: args[2], client: args[4] });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return report.status === "ready_for_review" ? 0 : report.status === "failed" ? 1 : 2;
  } catch {
    process.stderr.write("multiplayer_pilot_input_error\n");
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
