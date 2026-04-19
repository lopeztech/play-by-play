import * as THREE from "three";

export function createBall(scene: THREE.Scene): THREE.Mesh {
  // Rugby-ball prolate at a scale that reads clearly on the field. Real
  // dimensions are ~28cm long; we exaggerate for visibility.
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.65, 20, 14),
    new THREE.MeshStandardMaterial({
      color: 0xd9a066,
      roughness: 0.5,
      metalness: 0.05,
      emissive: 0x3a2514,
      emissiveIntensity: 0.4,
    }),
  );
  ball.scale.set(1.5, 0.85, 0.85);
  ball.castShadow = true;
  ball.position.set(0, 0.8, 0);

  // Subtle yellow halo so the ball stays visible from distance.
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 16, 10),
    new THREE.MeshBasicMaterial({
      color: 0xffe24d,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  halo.scale.set(1.5, 0.85, 0.85);
  ball.add(halo);

  scene.add(ball);
  return ball;
}
