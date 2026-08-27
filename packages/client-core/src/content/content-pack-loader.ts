import * as THREE from 'three';
import type { ContentEntity, GameContentGraph } from '@ultod/content-sdk';

export type EntityVisualizer = (entity: ContentEntity<unknown>) => THREE.Object3D | null;

/** Mounts validated content graphs into client Three.js scene graphs. */
export class ContentPackLoader {
  private mounted = new Map<string, THREE.Object3D>();
  private visualizers = new Map<string, EntityVisualizer>();

  constructor() {
    // Default synthetic visualizer for realm/location/item/npc
    this.registerVisualizer('realm', (entity) => {
      const group = new THREE.Group();
      group.name = `entity_${entity.id}`;
      return group;
    });
    this.registerVisualizer('location', (entity) => {
      const marker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.5, 0.1, 8),
        new THREE.MeshLambertMaterial({ color: 0x4f46e5 }),
      );
      marker.name = `entity_${entity.id}`;
      return marker;
    });
  }

  registerVisualizer(kind: string, visualizer: EntityVisualizer): void {
    this.visualizers.set(kind, visualizer);
  }

  mount(graph: GameContentGraph, scene: THREE.Scene): Map<string, THREE.Object3D> {
    for (const entity of graph.entities) {
      const visualizer = this.visualizers.get(entity.kind);
      const obj = visualizer ? visualizer(entity) : this.createFallbackVisualizer(entity);
      if (obj) {
        scene.add(obj);
        this.mounted.set(entity.id, obj);
      }
    }
    return this.mounted;
  }

  unmount(scene: THREE.Scene): void {
    for (const [, obj] of this.mounted) {
      scene.remove(obj);
    }
    this.mounted.clear();
  }

  getMountedEntities(): ReadonlyMap<string, THREE.Object3D> {
    return this.mounted;
  }

  private createFallbackVisualizer(entity: ContentEntity<unknown>): THREE.Object3D {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x9ca3af }),
    );
    mesh.name = `fallback_${entity.id}`;
    return mesh;
  }
}
