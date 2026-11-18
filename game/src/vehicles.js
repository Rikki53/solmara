// Solmara vehicle systems: 3D procedural car models, arcade driving physics, and enter/exit mechanics.
import * as THREE from 'three';
import { clamp, lerp, damp, normalizeAngle, circleIntersectsAABB } from './utils.js';

export const VEHICLE_CONFIGS = {
  sport: {
    name: 'Veloce GT',
    type: 'sport',
    length: 4.4,
    width: 2.1,
    height: 1.25,
    wheelbase: 2.7,
    maxSpeed: 44.0,       // ~100 mph
    reverseSpeed: -14.0,
    accelRate: 24.0,
    brakeRate: 36.0,
    steerAngle: 0.52,
    driftGrip: 0.88,
    colors: [0xd32f2f, 0xf57c00, 0x1976d2, 0x388e3c, 0xfbc02d, 0x212121],
  },
  sedan: {
    name: 'Stallion 400',
    type: 'sedan',
    length: 4.6,
    width: 2.1,
    height: 1.45,
    wheelbase: 2.8,
    maxSpeed: 34.0,       // ~75 mph
    reverseSpeed: -12.0,
    accelRate: 18.0,
    brakeRate: 28.0,
    steerAngle: 0.48,
    driftGrip: 0.92,
    colors: [0x37474f, 0x546e7a, 0x455a64, 0x8d6e63, 0x78909c, 0xffffff],
  },
  taxi: {
    name: 'Solmara Cab',
    type: 'taxi',
    length: 4.6,
    width: 2.1,
    height: 1.48,
    wheelbase: 2.8,
    maxSpeed: 33.0,
    reverseSpeed: -12.0,
    accelRate: 17.0,
    brakeRate: 28.0,
    steerAngle: 0.48,
    driftGrip: 0.92,
    colors: [0xffb300], // Iconic coastal yellow
  },
  pickup: {
    name: 'Brawn 4x4',
    type: 'pickup',
    length: 5.0,
    width: 2.2,
    height: 1.7,
    wheelbase: 3.1,
    maxSpeed: 30.0,
    reverseSpeed: -10.0,
    accelRate: 15.0,
    brakeRate: 25.0,
    steerAngle: 0.44,
    driftGrip: 0.94,
    colors: [0x5d4037, 0x3e2723, 0x263238, 0xbf360c, 0x455a64],
  },
};

export class Vehicle {
  constructor(scene, configType = 'sedan', x = 0, z = 0, heading = 0, customColor = null) {
    this.scene = scene;
    this.config = VEHICLE_CONFIGS[configType] || VEHICLE_CONFIGS.sedan;

    // Physics state
    this.x = x;
    this.y = 0.45;
    this.z = z;
    this.heading = heading; // Facing angle in radians (0 is +Z, PI/2 is +X)
    this.speed = 0;         // Forward speed in m/s
    this.steerInput = 0;    // Target steering (-1 to 1)
    this.throttleInput = 0; // Target throttle/brake (-1 to 1)
    this.handbrake = false;
    this.driftSlip = 0;     // Angular slip rate
    this.isOccupied = false;
    this.isBraking = false;

    // Radius for circle collision approximation
    this.collisionRadius = 2.1;

    // Wheels references for visual animation
    this.wheels = [];
    this.frontWheels = [];
    this.wheelRotation = 0;

    // Mesh setup
    this.group = new THREE.Group();
    this.color = customColor || this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
    this.buildMesh();
    this.updateTransform();
    this.scene.add(this.group);
  }

  buildMesh() {
    const { length, width, height, type } = this.config;

    // 1. Main Car Body Material
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.25,
      metalness: 0.4,
      flatShading: true,
    });
    const blackTrimMat = new THREE.MeshLambertMaterial({ color: 0x1f2124 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x1a2630,
      roughness: 0.1,
      metalness: 0.8,
    });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.9, roughness: 0.2 });

    // Chassis base
    const chassisGeo = new THREE.BoxGeometry(width, 0.45, length);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.y = 0.45;
    chassis.castShadow = true;
    chassis.receiveShadow = true;
    this.group.add(chassis);

    // Cabin / Windshield / Roof based on car type
    if (type === 'sport') {
      // Low slung aerodynamic cabin
      const cabinGeo = new THREE.BoxGeometry(width * 0.88, 0.55, length * 0.52);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.85, -0.2);
      this.group.add(cabin);

      // Roof cap
      const roofGeo = new THREE.BoxGeometry(width * 0.82, 0.08, length * 0.42);
      const roof = new THREE.Mesh(roofGeo, bodyMat);
      roof.position.set(0, 1.15, -0.2);
      this.group.add(roof);

      // Rear Spoiler
      const spoilerWingGeo = new THREE.BoxGeometry(width * 0.9, 0.06, 0.4);
      const spoiler = new THREE.Mesh(spoilerWingGeo, blackTrimMat);
      spoiler.position.set(0, 1.05, -length * 0.44);
      this.group.add(spoiler);
    } else if (type === 'pickup') {
      // Front cabin
      const cabinGeo = new THREE.BoxGeometry(width * 0.9, 0.8, length * 0.4);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.95, length * 0.05);
      this.group.add(cabin);

      const roofGeo = new THREE.BoxGeometry(width * 0.86, 0.1, length * 0.36);
      const roof = new THREE.Mesh(roofGeo, bodyMat);
      roof.position.set(0, 1.4, length * 0.05);
      this.group.add(roof);

      // Open cargo bed sides
      const bedWallGeoL = new THREE.BoxGeometry(0.12, 0.5, length * 0.42);
      const bedWallL = new THREE.Mesh(bedWallGeoL, bodyMat);
      bedWallL.position.set(-width * 0.44, 0.75, -length * 0.26);
      const bedWallR = new THREE.Mesh(bedWallGeoL, bodyMat);
      bedWallR.position.set(width * 0.44, 0.75, -length * 0.26);
      this.group.add(bedWallL);
      this.group.add(bedWallR);
    } else {
      // Sedan & Taxi cabin
      const cabinGeo = new THREE.BoxGeometry(width * 0.88, 0.65, length * 0.54);
      const cabin = new THREE.Mesh(cabinGeo, glassMat);
      cabin.position.set(0, 0.92, -0.05);
      this.group.add(cabin);

      const roofGeo = new THREE.BoxGeometry(width * 0.84, 0.08, length * 0.46);
      const roof = new THREE.Mesh(roofGeo, bodyMat);
      roof.position.set(0, 1.28, -0.05);
      this.group.add(roof);

      // Taxi roof light sign
      if (type === 'taxi') {
        const signGeo = new THREE.BoxGeometry(0.7, 0.22, 0.35);
        const signMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const sign = new THREE.Mesh(signGeo, signMat);
        sign.position.set(0, 1.45, -0.05);
        this.group.add(sign);
      }
    }

    // Bumpers
    const bumperGeo = new THREE.BoxGeometry(width * 0.95, 0.22, 0.3);
    const frontBumper = new THREE.Mesh(bumperGeo, blackTrimMat);
    frontBumper.position.set(0, 0.32, length * 0.48);
    const rearBumper = new THREE.Mesh(bumperGeo, blackTrimMat);
    rearBumper.position.set(0, 0.32, -length * 0.48);
    this.group.add(frontBumper);
    this.group.add(rearBumper);

    // Headlights (front: +Z in vehicle local space)
    const lightGeo = new THREE.BoxGeometry(0.35, 0.16, 0.1);
    this.headlightMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
    const hLightL = new THREE.Mesh(lightGeo, this.headlightMat);
    hLightL.position.set(-width * 0.36, 0.48, length * 0.5);
    const hLightR = new THREE.Mesh(lightGeo, this.headlightMat);
    hLightR.position.set(width * 0.36, 0.48, length * 0.5);
    this.group.add(hLightL);
    this.group.add(hLightR);

    // Taillights (rear: -Z in vehicle local space)
    this.taillightMat = new THREE.MeshBasicMaterial({ color: 0xd32f2f });
    const tLightL = new THREE.Mesh(lightGeo, this.taillightMat);
    tLightL.position.set(-width * 0.36, 0.48, -length * 0.5);
    const tLightR = new THREE.Mesh(lightGeo, this.taillightMat);
    tLightR.position.set(width * 0.36, 0.48, -length * 0.5);
    this.group.add(tLightL);
    this.group.add(tLightR);

    // 4 Wheels
    const wheelRadius = 0.38;
    const wheelWidth = 0.28;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 12);
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x1b1c1e });
    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, wheelWidth + 0.02, 8);

    const halfW = width * 0.48;
    const halfBase = this.config.wheelbase * 0.5;

    const wheelPositions = [
      { x: -halfW, z: halfBase, isFront: true },   // Front Left
      { x: halfW, z: halfBase, isFront: true },    // Front Right
      { x: -halfW, z: -halfBase, isFront: false }, // Rear Left
      { x: halfW, z: -halfBase, isFront: false },  // Rear Right
    ];

    for (const wp of wheelPositions) {
      const wheelPivot = new THREE.Group();
      wheelPivot.position.set(wp.x, wheelRadius, wp.z);

      const wheelMesh = new THREE.Mesh(wheelGeo, tireMat);
      wheelMesh.rotation.z = Math.PI / 2;
      wheelPivot.add(wheelMesh);

      const rimMesh = new THREE.Mesh(rimGeo, chromeMat);
      rimMesh.rotation.z = Math.PI / 2;
      wheelPivot.add(rimMesh);

      this.group.add(wheelPivot);
      this.wheels.push(wheelPivot);
      if (wp.isFront) {
        this.frontWheels.push(wheelPivot);
      }
    }
  }

  /** Updates the visual position and rotation of the vehicle in the 3D scene. */
  updateTransform() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
  }

  /** Driving physics simulation tick. */
  step(dt, colliders, boundaries) {
    const { maxSpeed, reverseSpeed, accelRate, brakeRate, steerAngle, driftGrip, wheelbase } = this.config;

    // 1. Throttle / Acceleration & Braking
    this.isBraking = false;
    if (this.throttleInput > 0) {
      // Accelerating forward
      if (this.speed < maxSpeed) {
        this.speed += this.throttleInput * accelRate * dt;
      }
    } else if (this.throttleInput < 0) {
      if (this.speed > 0.5) {
        // Braking while moving forward
        this.speed -= brakeRate * dt;
        this.isBraking = true;
      } else {
        // Reversing
        if (this.speed > reverseSpeed) {
          this.speed += this.throttleInput * (accelRate * 0.7) * dt;
        }
      }
    } else {
      // Coasting drag
      this.speed = damp(this.speed, 0, 1.2, dt);
    }

    // 2. Handbrake / Drift
    if (this.handbrake) {
      this.isBraking = true;
      this.speed = damp(this.speed, 0, 2.5, dt);
      this.driftSlip = lerp(this.driftSlip, 1.8, 4.0 * dt);
    } else {
      this.driftSlip = damp(this.driftSlip, 0, 5.0, dt);
    }

    // Update taillight glow on braking
    if (this.taillightMat) {
      this.taillightMat.color.setHex(this.isBraking ? 0xff1744 : 0x8a1515);
    }

    // 3. Steering & Yaw Rotation
    const currentSteer = this.steerInput * steerAngle;
    for (const fw of this.frontWheels) {
      fw.rotation.y = currentSteer;
    }

    // Ackermann steering angular velocity
    if (Math.abs(this.speed) > 0.1) {
      const turnMultiplier = this.handbrake ? 1.6 : 1.0;
      const angularVel = (this.speed / wheelbase) * Math.sin(currentSteer) * turnMultiplier;
      this.heading = normalizeAngle(this.heading + angularVel * dt);
    }

    // 4. Position movement
    // Note: Heading 0 points in +Z direction, heading PI/2 points in +X direction
    const forwardX = Math.sin(this.heading);
    const forwardZ = Math.cos(this.heading);

    let nextX = this.x + forwardX * this.speed * dt;
    let nextZ = this.z + forwardZ * this.speed * dt;

    // 5. Collision checks with city buildings
    let hadCollision = false;
    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      const test = circleIntersectsAABB(nextX, nextZ, this.collisionRadius, b.minX, b.minZ, b.maxX, b.maxZ);
      if (test.hit) {
        nextX += test.normalX * test.depth;
        nextZ += test.normalZ * test.depth;
        hadCollision = true;
      }
    }

    // Boundary constraints
    if (boundaries) {
      if (nextX < boundaries.minX + 2) { nextX = boundaries.minX + 2; hadCollision = true; }
      if (nextX > boundaries.maxX - 2) { nextX = boundaries.maxX - 2; hadCollision = true; }
      if (nextZ < boundaries.minZ + 2) { nextZ = boundaries.minZ + 2; hadCollision = true; }
      if (nextZ > boundaries.maxZ - 2) { nextZ = boundaries.maxZ - 2; hadCollision = true; }
    }

    if (hadCollision) {
      this.speed *= -0.25; // Elastic bounce
    }

    this.x = nextX;
    this.z = nextZ;

    // 6. Wheel rolling animation
    const wheelRadius = 0.38;
    this.wheelRotation += (this.speed / wheelRadius) * dt;
    for (const w of this.wheels) {
      w.children[0].rotation.x = this.wheelRotation;
      w.children[1].rotation.x = this.wheelRotation;
    }

    this.updateTransform();
  }

  /** Tests if player is near enough to the vehicle to enter. */
  canEnter(playerX, playerZ) {
    const dx = playerX - this.x;
    const dz = playerZ - this.z;
    const distSq = dx * dx + dz * dz;
    return distSq < 22.0; // ~4.7 meters
  }

  /** Position where player should spawn when exiting. */
  getExitPosition() {
    // Left side of the car
    const sideX = Math.sin(this.heading - Math.PI / 2);
    const sideZ = Math.cos(this.heading - Math.PI / 2);
    return {
      x: this.x + sideX * 2.2,
      z: this.z + sideZ * 2.2,
    };
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
