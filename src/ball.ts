import * as THREE from "three";

export function createBall(scene: THREE.Scene): THREE.Mesh {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.5,
      metalness: 0.05,
    }),
  );
  // Elongate into a rugby-ball prolate
  ball.scale.set(1.4, 0.85, 0.85);
  ball.castShadow = true;
  ball.position.set(0, 0.5, 0);
  scene.add(ball);
  return ball;
}
