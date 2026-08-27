import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface BlueprintTile { x: number; z: number; part_id: string; }
export interface BlueprintWall { x: number; z: number; edge: string; part_id: string; }
export interface BlueprintProp { prop_id?: string; part_id?: string; x?: number; z?: number; position?: number[]; rotation_y?: number; scale?: number; }
export interface BlueprintFloor { level: number; tiles?: BlueprintTile[]; walls?: BlueprintWall[]; props?: BlueprintProp[]; }
export interface BlueprintRoof { x: number; z: number; part_id: string; rotation?: number; }
export interface HouseBlueprint {
  blueprint_id: string;
  name?: string;
  lot: { width: number; depth: number; cell_size: number; floor_height: number };
  floors: BlueprintFloor[];
  roof?: BlueprintRoof[];
  garden?: BlueprintProp[];
}

export interface ColliderBox {
  min: [number, number, number];
  max: [number, number, number];
  kind: 'floor' | 'wall' | 'roof';
}

export interface BridgeResult {
  group: THREE.Group;
  colliders: ColliderBox[];
  loadedModels: Set<string>;
  failedModels: Set<string>;
}

const WALL_THICKNESS = 0.15;

export function buildFromBlueprint(
  bp: HouseBlueprint,
  loader: GLTFLoader,
  modelResolver: (partId: string) => string | null,
  worldOffset = new THREE.Vector3(),
): BridgeResult {
  const group = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const loadedModels = new Set<string>();
  const failedModels = new Set<string>();
  const cellSize = bp.lot.cell_size;
  const floorHeight = bp.lot.floor_height;
  const originX = -(bp.lot.width * cellSize) / 2 + worldOffset.x;
  const originZ = -(bp.lot.depth * cellSize) / 2 + worldOffset.z;

  const tileBatches = new Map<string, THREE.Matrix4[]>();
  const wallBatches = new Map<string, THREE.Matrix4[]>();
  const roofBatches = new Map<string, THREE.Matrix4[]>();
  const propRequests: Array<{ partId: string; pos: THREE.Vector3; rotY: number; scale: number }> = [];

  const pushBatch = (map: Map<string, THREE.Matrix4[]>, id: string, m: THREE.Matrix4) => {
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(m);
  };

  for (const floor of bp.floors ?? []) {
    const y = floor.level * floorHeight + worldOffset.y;
    for (const tile of floor.tiles ?? []) {
      const px = originX + (tile.x + 0.5) * cellSize;
      const pz = originZ + (tile.z + 0.5) * cellSize;
      const py = y;
      const m = new THREE.Matrix4().makeTranslation(px, py, pz);
      pushBatch(tileBatches, tile.part_id, m);
      colliders.push({ min: [px - cellSize / 2, py, pz - cellSize / 2], max: [px + cellSize / 2, py + 0.05, pz + cellSize / 2], kind: 'floor' });
    }
    for (const wall of floor.walls ?? []) {
      const isN = wall.edge === 'N';
      const wx = originX + (isN ? wall.x + 0.5 : wall.x) * cellSize;
      const wz = originZ + (isN ? wall.z : wall.z + 0.5) * cellSize;
      const rotY = isN ? Math.PI / 2 : 0;
      const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(wx, y + floorHeight / 2, wz);
      pushBatch(wallBatches, wall.part_id, m);
      const halfW = cellSize / 2;
      const t = WALL_THICKNESS / 2;
      colliders.push(isN
        ? { min: [wx - t, y, wz - halfW], max: [wx + t, y + floorHeight, wz + halfW], kind: 'wall' }
        : { min: [wx - halfW, y, wz - t], max: [wx + halfW, y + floorHeight, wz + t], kind: 'wall' });
    }
    for (const p of floor.props ?? []) {
      const partId = p.prop_id ?? p.part_id ?? '';
      if (!partId || p.x === undefined || p.z === undefined) continue;
      const px = originX + (p.x + 0.5) * cellSize;
      const pz = originZ + (p.z + 0.5) * cellSize;
      propRequests.push({ partId, pos: new THREE.Vector3(px, y, pz), rotY: 0, scale: 1 });
    }
  }

  for (const r of bp.roof ?? []) {
    const px = originX + (r.x + 0.5) * cellSize;
    const pz = originZ + (r.z + 0.5) * cellSize;
    const top = (bp.floors?.length ?? 1) * floorHeight + worldOffset.y;
    const rotY = ((r.rotation ?? 0) * Math.PI) / 180;
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(px, top, pz);
    pushBatch(roofBatches, r.part_id, m);
  }

  for (const g of bp.garden ?? []) {
    const partId = g.part_id ?? '';
    if (!partId) continue;
    const pos = g.position
      ? new THREE.Vector3(g.position[0] ?? 0, g.position[1] ?? 0, g.position[2] ?? 0).add(worldOffset)
      : worldOffset.clone();
    propRequests.push({ partId, pos, rotY: g.rotation_y ?? 0, scale: g.scale ?? 1 });
  }

  const instantiateBatch = (
    map: Map<string, THREE.Matrix4[]>,
    fallbackColor: string,
    dims: [number, number, number],
  ) => {
    for (const [partId, matrices] of map) {
      const url = modelResolver(partId);
      if (!url) {
        const geo = new THREE.BoxGeometry(...dims);
        const mat = new THREE.MeshLambertMaterial({ color: fallbackColor });
        const inst = new THREE.InstancedMesh(geo, mat, matrices.length);
        matrices.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = true;
        inst.receiveShadow = true;
        group.add(inst);
      } else {
        loader.load(url,
          (gltf) => {
            gltf.scene.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true; });
            const inst = new THREE.InstancedMesh(new THREE.BufferGeometry(), undefined!, matrices.length);
            gltf.scene.position.set(0, 0, 0);
            matrices.forEach((m) => {
              const clone = gltf.scene.clone();
              clone.applyMatrix4(m);
              group.add(clone);
            });
            loadedModels.add(partId);
            matrices.forEach((m, i) => inst.setMatrixAt(i, m));
            inst.instanceMatrix.needsUpdate = true;
            group.add(inst);
            loadedModels.add(partId);
          },
          undefined,
          () => failedModels.add(partId),
        );
      }
    }
  };

  instantiateBatch(tileBatches, '#8a6a43', [cellSize, 0.1, cellSize]);
  instantiateBatch(wallBatches, '#7d8089', [cellSize, floorHeight, WALL_THICKNESS]);
  instantiateBatch(roofBatches, '#6e3a2a', [cellSize, 0.35, cellSize]);

  for (const req of propRequests) {
    const url = modelResolver(req.partId);
    if (!url) continue;
    loader.load(url,
      (gltf) => {
        gltf.scene.position.copy(req.pos);
        gltf.scene.rotation.y = req.rotY;
        gltf.scene.scale.setScalar(req.scale);
        gltf.scene.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true; });
        group.add(gltf.scene);
        loadedModels.add(req.partId);
      },
      undefined,
      () => failedModels.add(req.partId),
    );
  }

  return { group, colliders, loadedModels, failedModels };
}
