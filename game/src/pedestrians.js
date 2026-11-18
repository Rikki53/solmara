// Solmara ambient pedestrian system: spawns, animates, and steers pedestrians on sidewalks with panic AI.
import * as THREE from 'three';
import { dist2D, distSq2D, angleLerp, damp, createRng } from './utils.js';

export class PedestrianManager {
  constructor(scene, city, seed = 101) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(seed);

    this.pedestrians = [];
    this.maxPeds = 24;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.spawnInitialPedestrians();
  }

  spawnInitialPedestrians() {
    const nodes = this.city.sidewalkNodes;
    if (!nodes || nodes.length === 0) return;

    for (let i = 0; i < this.maxPeds; i++) {
      const node = nodes[i % nodes.length];
      const ped = this.createPedestrian(node.x + (this.rng() - 0.5) * 3, node.z + (this.rng() - 0.5) * 3);
      this.pedestrians.push(ped);
    }
  }

  createPedestrian(x, z) {
    const pedGroup = new THREE.Group();
    pedGroup.position.set(x, 0, z);

    // Color variations
    const skinTones = [0xd6996d, 0xba7d56, 0xefbe99, 0x8a5639, 0xf2cbac];
    const shirtColors = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0x457b9d, 0xffffff, 0x1d3557];
    const pantColors = [0x264653, 0x3d5a80, 0x6c757d, 0xd08c50, 0x1f2421];

    const skinColor = skinTones[Math.floor(this.rng() * skinTones.length)];
    const shirtColor = shirtColors[Math.floor(this.rng() * shirtColors.length)];
    const pantColor = pantColors[Math.floor(this.rng() * pantColors.length)];

    const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor, flatShading: true });
    const pantMat = new THREE.MeshLambertMaterial({ color: pantColor, flatShading: true });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.65, 0.28);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.15;
    torso.castShadow = true;
    pedGroup.add(torso);

    // Head
    const headGeo = new THREE.BoxGeometry(0.28, 0.3, 0.26);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.48;
    torso.add(head);

    // Left & Right Arms
    const armGeo = new THREE.BoxGeometry(0.14, 0.52, 0.14);
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.31, 0.24, 0);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.y = -0.22;
    leftArmPivot.add(leftArm);
    torso.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.31, 0.24, 0);
    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.y = -0.22;
    rightArmPivot.add(rightArm);
    torso.add(rightArmPivot);

    // Left & Right Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.14, 0.75, 0);
    const leftLeg = new THREE.Mesh(legGeo, pantMat);
    leftLeg.position.y = -0.3;
    leftLegPivot.add(leftLeg);
    pedGroup.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.14, 0.75, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantMat);
    rightLeg.position.y = -0.3;
    rightLegPivot.add(rightLeg);
    pedGroup.add(rightLegPivot);

    this.group.add(pedGroup);

    return {
      group: pedGroup,
      leftArmPivot,
      rightArmPivot,
      leftLegPivot,
      rightLegPivot,
      x,
      z,
      heading: this.rng() * Math.PI * 2,
      speed: 1.4 + this.rng() * 0.8,
      walkCycle: this.rng() * 10,
      targetNode: this.findNearestSidewalkNode(x, z),
      state: 'walking', // 'walking' | 'panicked'
      panicTimer: 0,
    };
  }

  findNearestSidewalkNode(x, z) {
    const nodes = this.city.sidewalkNodes;
    if (!nodes || nodes.length === 0) return { x, z };
    let best = nodes[0];
    let minDistSq = 999999;
    for (let i = 0; i < nodes.length; i++) {
      const dSq = distSq2D(x, z, nodes[i].x, nodes[i].z);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        best = nodes[i];
      }
    }
    return best;
  }

  step(dt, player, vehicles) {
    const playerX = player.x;
    const playerZ = player.z;

    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];

      // Distance from player
      const distToPlayer = dist2D(ped.x, ped.z, playerX, playerZ);

      // Despawn if too far (> 140m)
      if (distToPlayer > 150) {
        this.recyclePedestrian(ped, playerX, playerZ);
        continue;
      }

      // Check proximity to player or moving vehicles for panic
      let dangerDist = 999;
      let dangerX = 0;
      let dangerZ = 0;

      // Player threat (especially when driving)
      if (player.mode === 'driving' && player.vehicle && Math.abs(player.vehicle.speed) > 4.0) {
        const d = dist2D(ped.x, ped.z, playerX, playerZ);
        if (d < 12.0) {
          dangerDist = d;
          dangerX = playerX;
          dangerZ = playerZ;
        }
      }

      // Moving vehicle threats
      for (let v = 0; v < vehicles.length; v++) {
        const veh = vehicles[v];
        if (Math.abs(veh.speed) > 5.0) {
          const vd = dist2D(ped.x, ped.z, veh.x, veh.z);
          if (vd < 10.0 && vd < dangerDist) {
            dangerDist = vd;
            dangerX = veh.x;
            dangerZ = veh.z;
          }
        }
      }

      // Enter panic if in danger
      if (dangerDist < 10.0) {
        ped.state = 'panicked';
        ped.panicTimer = 2.5;
        // Run away from threat
        const awayAngle = Math.atan2(ped.x - dangerX, ped.z - dangerZ);
        ped.heading = awayAngle;
        ped.speed = 4.8;
      }

      if (ped.state === 'panicked') {
        ped.panicTimer -= dt;
        if (ped.panicTimer <= 0) {
          ped.state = 'walking';
          ped.speed = 1.6;
          ped.targetNode = this.findNearestSidewalkNode(ped.x, ped.z);
        }
      } else {
        // Normal walking towards sidewalk node
        if (ped.targetNode) {
          const dx = ped.targetNode.x - ped.x;
          const dz = ped.targetNode.z - ped.z;
          const distToNode = Math.hypot(dx, dz);

          if (distToNode < 2.0) {
            // Pick another nearby sidewalk node
            const nodes = this.city.sidewalkNodes;
            ped.targetNode = nodes[Math.floor(this.rng() * nodes.length)];
          } else {
            const targetHeading = Math.atan2(dx, dz);
            ped.heading = angleLerp(ped.heading, targetHeading, 4.0 * dt);
          }
        }
      }

      // Move pedestrian forward
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;

      // Animate limbs
      ped.walkCycle += dt * (ped.speed * 4.5);
      const swing = Math.sin(ped.walkCycle) * 0.45;
      ped.leftLegPivot.rotation.x = swing;
      ped.rightLegPivot.rotation.x = -swing;

      if (ped.state === 'panicked') {
        // Flailing arms in panic
        ped.leftArmPivot.rotation.x = -1.2 + Math.sin(ped.walkCycle * 2) * 0.6;
        ped.rightArmPivot.rotation.x = -1.2 + Math.cos(ped.walkCycle * 2) * 0.6;
      } else {
        ped.leftArmPivot.rotation.x = -swing * 0.7;
        ped.rightArmPivot.rotation.x = swing * 0.7;
      }

      // Update 3D position
      ped.group.position.set(ped.x, 0.22, ped.z);
      ped.group.rotation.y = ped.heading;
    }
  }

  recyclePedestrian(ped, playerX, playerZ) {
    const nodes = this.city.sidewalkNodes;
    const node = nodes[Math.floor(this.rng() * nodes.length)];
    ped.x = node.x + (this.rng() - 0.5) * 3;
    ped.z = node.z + (this.rng() - 0.5) * 3;
    ped.heading = this.rng() * Math.PI * 2;
    ped.state = 'walking';
    ped.speed = 1.4 + this.rng() * 0.6;
    ped.targetNode = this.findNearestSidewalkNode(ped.x, ped.z);
    ped.group.position.set(ped.x, 0.22, ped.z);
  }
}
