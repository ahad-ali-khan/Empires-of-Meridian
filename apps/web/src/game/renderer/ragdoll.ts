import * as T from 'three';
// Mechanical units shed their existing rigid pieces, rather than bending limbs.
export class MachineWreck {
  private age = 0;
  private crew: Ragdoll[] = [];
  private parts: {node: T.Object3D; velocity: T.Vector3; spin: T.Vector3; floor: number}[] = [];
  constructor(
    private root: T.Group,
    seed: number,
  ) {
    for (const name of ['loader', 'rammer']) {
      const person = root.getObjectByName(name);
      if (person instanceof T.Group) this.crew.push(new Ragdoll(person, seed + this.crew.length));
    }
    root.updateMatrixWorld(true);
    const pieces: T.Mesh[] = [];
    root.traverse((o) => {
      if (o instanceof T.Mesh && o.visible) pieces.push(o);
    });
    for (const [i, node] of pieces.entries()) {
      // Keep crew articulated separately; only break the chassis and equipment.
      let p = node.parent,
        crew = false;
      while (p && p !== root) {
        if (p.name === 'loader' || p.name === 'rammer') crew = true;
        p = p.parent;
      }
      if (crew) continue;
      root.attach(node);
      const a = seed + i * 2.399963;
      node.geometry.computeBoundingBox();
      const extent = node.geometry.boundingBox!.getSize(new T.Vector3()).multiply(node.scale).length();
      this.parts.push({
        node,
        velocity: new T.Vector3(Math.sin(a) * 1.5, 1 + (i % 3) * 0.3, Math.cos(a) * 1.5),
        spin: new T.Vector3(Math.cos(a), Math.sin(a) * 2, Math.sin(a + 1)),
        floor: Math.min(0.25, extent * 0.15),
      });
    }
  }
  update(dt: number) {
    for (const person of this.crew) person.update(dt);
    if (this.age > 3) return;
    this.age += dt;
    for (const p of this.parts) {
      p.velocity.y -= 7 * dt;
      p.node.position.addScaledVector(p.velocity, dt);
      p.node.rotateX(p.spin.x * dt);
      p.node.rotateZ(p.spin.z * dt);
      if (p.node.position.y < p.floor) {
        p.node.position.y = p.floor;
        p.velocity.y = Math.abs(p.velocity.y) * 0.15;
        p.velocity.x *= 0.75;
        p.velocity.z *= 0.75;
        p.spin.multiplyScalar(0.7);
      }
    }
  }
}
// Presentation-only articulated fall. Angular momentum, damped joints and floor
// contact cannot change damage, position, ownership or any simulation result.
export class Ragdoll {
  private body: T.Object3D;
  private angle = 0.03;
  private speed: number;
  private axis: T.Vector3;
  private age = 0;
  private joints: {node: T.Object3D; rest: T.Euler; velocity: T.Vector3}[] = [];
  private restY: number;
  constructor(
    private root: T.Group,
    seed: number,
  ) {
    this.body =
      root.getObjectByName('horseBody') ??
      root.getObjectByName('sheepBody') ??
      root.getObjectByName('animalBody') ??
      root.getObjectByName('body') ??
      root;
    this.restY = this.body.position.y;
    const angle = (seed * 2.399963) % (Math.PI * 2);
    this.axis = new T.Vector3(Math.cos(angle), 0, Math.sin(angle));
    this.speed = 0.8 + (seed % 7) * 0.12;
    this.body.traverse((node) => {
      if (/^(arm|elbow|leg|knee|head|horseLeg|hock|animalLeg|sheepLeg|horseHead)/.test(node.name))
        this.joints.push({
          node,
          rest: node.rotation.clone(),
          velocity: new T.Vector3(
            Math.sin(seed + this.joints.length) * 2,
            Math.cos(seed + this.joints.length) * 0.8,
            Math.sin(seed * 3 + this.joints.length) * 1.4,
          ),
        });
    });
  }
  update(dt: number) {
    if (this.age > 3.5) return;
    this.age += dt;
    this.speed += Math.sin(this.angle + 0.15) * 6 * dt;
    this.speed *= Math.exp(-dt * 0.8);
    this.angle += this.speed * dt;
    if (this.angle > 1.5) {
      this.angle = 1.5;
      this.speed *= -0.18;
    }
    this.body.quaternion.setFromAxisAngle(this.axis, this.angle);
    for (const j of this.joints) {
      j.velocity.multiplyScalar(Math.exp(-dt * 2));
      j.node.rotation.x = T.MathUtils.clamp(j.node.rotation.x + j.velocity.x * dt, -1.6, 1.6);
      j.node.rotation.z = T.MathUtils.clamp(j.node.rotation.z + j.velocity.z * dt, -0.9, 0.9);
    }
    this.body.position.y = this.restY;
    this.root.updateMatrixWorld(true);
    const bounds = new T.Box3();
    this.body.traverse((o) => {
      if (o instanceof T.Mesh && o.visible) {
        let visible = true,
          p = o.parent;
        while (p && p !== this.body) {
          if (!p.visible) visible = false;
          p = p.parent;
        }
        if (visible) {
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          bounds.union(o.geometry.boundingBox!.clone().applyMatrix4(o.matrixWorld));
        }
      }
    });
    const ground = this.root.getWorldPosition(new T.Vector3()).y;
    if (!bounds.isEmpty())
      this.body.position.y += Math.max(0, ground - bounds.min.y) / this.root.getWorldScale(new T.Vector3()).y;
  }
}
