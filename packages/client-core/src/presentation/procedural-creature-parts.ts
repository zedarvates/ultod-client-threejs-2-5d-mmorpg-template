import * as THREE from 'three';

export function createProceduralCreaturePart(partId: string): THREE.Object3D {
  const group = new THREE.Group();
  group.name = `procedural_${partId}`;
  const material = new THREE.MeshLambertMaterial({ color: 0x3eb489, flatShading: true });

  const geometry = partId.startsWith('wing_')
    ? new THREE.ConeGeometry(0.35, 0.9, 3)
    : partId.startsWith('tail_')
      ? new THREE.ConeGeometry(0.12, 0.8, 6)
      : partId.startsWith('leg_')
        ? new THREE.CylinderGeometry(0.08, 0.12, 0.7, 6)
        : new THREE.ConeGeometry(0.18, 0.5, 6);

  group.add(new THREE.Mesh(geometry, material));
  return group;
}
