import * as THREE from "three";

// Rugby league field: 100m between try lines + 10m in-goals each end = 120m.
// Width: 68m. Units are metres; we centre the field at origin.
export const FIELD = {
  length: 120,
  width: 68,
  playLength: 100,
  inGoal: 10,
};

export function buildField(scene: THREE.Scene): void {
  const grass = new THREE.MeshStandardMaterial({ color: 0x2f7a3f });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.length, FIELD.width),
    grass,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff });

  const addLine = (x: number) => {
    const geom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.01, -FIELD.width / 2),
      new THREE.Vector3(x, 0.01, FIELD.width / 2),
    ]);
    scene.add(new THREE.Line(geom, lineMat));
  };

  // Try lines, halfway, 20m, 40m markers (both sides)
  const half = FIELD.playLength / 2;
  addLine(-half);
  addLine(half);
  addLine(0);
  addLine(-half + 20);
  addLine(half - 20);
  addLine(-half + 40);
  addLine(half - 40);

  // In-goal back lines
  addLine(-FIELD.length / 2);
  addLine(FIELD.length / 2);

  // Sidelines
  const sideGeom = (z: number) =>
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-FIELD.length / 2, 0.01, z),
      new THREE.Vector3(FIELD.length / 2, 0.01, z),
    ]);
  scene.add(new THREE.Line(sideGeom(-FIELD.width / 2), lineMat));
  scene.add(new THREE.Line(sideGeom(FIELD.width / 2), lineMat));

  // Goal posts
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2 });
  const postGeom = new THREE.CylinderGeometry(0.15, 0.15, 8);
  for (const sign of [-1, 1]) {
    for (const offset of [-2.8, 2.8]) {
      const post = new THREE.Mesh(postGeom, postMat);
      post.position.set(sign * half, 4, offset);
      scene.add(post);
    }
    const crossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 5.6),
      postMat,
    );
    crossbar.rotation.x = Math.PI / 2;
    crossbar.position.set(sign * half, 3, 0);
    scene.add(crossbar);
  }
}
