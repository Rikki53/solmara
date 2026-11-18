// Solmara player character (Kai Marlow) and third-person mouse-orbit camera system.
import * as THREE from 'three';
import { clamp, lerp, damp, normalizeAngle, angleLerp, circleIntersectsAABB } from './utils.js';

export class Player {
  constructor(scene, camera, x = 0, z = 0) {
    this.scene = scene;
    this.camera = camera;

    // Position & physics state
    this.x = x;
    this.y = 0;
    this.z = z;
    this.vy = 0;
    this.isGrounded = true;
    this.heading = 0; // Player facing direction

    this.walkSpeed = 5.2;
    this.sprintSpeed = 9.2;
    this.jumpForce = 7.5;
    this.gravity = 22.0;
    this.collisionRadius = 0.55;

    // Mode: 'foot' or 'driving'
    this.mode = 'foot';
    this.vehicle = null;
    this.health = 100;

    // Camera orbit parameters
    this.camYaw = Math.PI; // Orbit yaw
    this.camPitch = 0.25;  // Orbit pitch (radians)
    this.camDistance = 5.4;
    this.camHeight = 2.0;

    // Limb animation state
    this.walkCycle = 0;

    // Character 3D hierarchy
    this.group = new THREE.Group();
    this.buildCharacterMesh();
    this.updateTransform();
    this.scene.add(this.group);
  }

  buildCharacterMesh() {
    // Stylized low-poly model for Kai Marlow: tropical shirt, denim jeans, sneakers
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd99a6c });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x228b7e, flatShading: true }); // Coastal teal
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x303e54, flatShading: true }); // Denim navy
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x221c1a });
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });

    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.72, 0.32);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.25;
    this.torso.castShadow = true;
    this.group.add(this.torso);

    // 2. Head
    const headGeo = new THREE.BoxGeometry(0.32, 0.34, 0.3);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.54;
    this.torso.add(head);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.34, 0.16, 0.32);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 0.16;
    head.add(hair);

    // Sunglasses
    const glassesMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const glassesGeo = new THREE.BoxGeometry(0.28, 0.08, 0.06);
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    glasses.position.set(0, 0.02, 0.16);
    head.add(glasses);

    // 3. Arms (pivots at shoulder height)
    const armGeo = new THREE.BoxGeometry(0.16, 0.58, 0.18);

    // Left Arm
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.36, 0.28, 0);
    const leftArm = new THREE.Mesh(armGeo, shirtMat);
    leftArm.position.y = -0.25;
    this.leftArmPivot.add(leftArm);
    this.torso.add(this.leftArmPivot);

    // Right Arm
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.36, 0.28, 0);
    const rightArm = new THREE.Mesh(armGeo, shirtMat);
    rightArm.position.y = -0.25;
    this.rightArmPivot.add(rightArm);
    this.torso.add(this.rightArmPivot);

    // 4. Legs (pivots at hip height)
    const legGeo = new THREE.BoxGeometry(0.22, 0.68, 0.22);
    const shoeGeo = new THREE.BoxGeometry(0.23, 0.14, 0.3);

    // Left Leg
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.16, 0.88, 0);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.y = -0.34;
    const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
    leftShoe.position.set(0, -0.62, 0.04);
    this.leftLegPivot.add(leftLeg);
    this.leftLegPivot.add(leftShoe);
    this.group.add(this.leftLegPivot);

    // Right Leg
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.16, 0.88, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.y = -0.34;
    const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
    rightShoe.position.set(0, -0.62, 0.04);
    this.rightLegPivot.add(rightLeg);
    this.rightLegPivot.add(rightShoe);
    this.group.add(this.rightLegPivot);
  }

  updateTransform() {
    this.group.position.set(this.x, this.y, this.z);
    this.group.rotation.y = this.heading;
  }

  /** Main player update tick. */
  step(dt, input, colliders, boundaries, nearbyVehicles) {
    // 1. Mouse orbit look update
    const { dx, dy } = input.consumeMouseDeltas();
    const lookSens = 0.0028;
    this.camYaw -= dx * lookSens;
    this.camPitch = clamp(this.camPitch + dy * lookSens, -0.25, 1.1);

    // 2. Handle Enter / Exit vehicle action (E key)
    if (input.justPressed('enterExit')) {
      if (this.mode === 'foot') {
        // Try to enter nearest vehicle
        const vehicle = this.findNearestEnterableVehicle(nearbyVehicles);
        if (vehicle) {
          this.enterVehicle(vehicle);
          return;
        }
      } else if (this.mode === 'driving') {
        this.exitVehicle();
        return;
      }
    }

    if (this.mode === 'foot') {
      this.stepOnFoot(dt, input, colliders, boundaries);
    } else if (this.mode === 'driving' && this.vehicle) {
      this.stepDriving(dt, input, colliders, boundaries);
    }

    // 3. Update Camera position & orientation
    this.updateCamera(dt);
  }

  stepOnFoot(dt, input, colliders, boundaries) {
    // Determine movement direction relative to camera yaw
    let moveForward = 0;
    let moveRight = 0;

    if (input.isDown('forward')) moveForward += 1;
    if (input.isDown('backward')) moveForward -= 1;
    if (input.isDown('left')) moveRight -= 1;
    if (input.isDown('right')) moveRight += 1;

    const isMoving = moveForward !== 0 || moveRight !== 0;
    const isSprinting = isMoving && input.isDown('sprint');
    const speed = isSprinting ? this.sprintSpeed : this.walkSpeed;

    if (isMoving) {
      // Camera forward vector in XZ plane
      const camFwdX = -Math.sin(this.camYaw);
      const camFwdZ = -Math.cos(this.camYaw);
      const camRgtX = Math.cos(this.camYaw);
      const camRgtZ = -Math.sin(this.camYaw);

      let dirX = camFwdX * moveForward + camRgtX * moveRight;
      let dirZ = camFwdZ * moveForward + camRgtZ * moveRight;
      const len = Math.hypot(dirX, dirZ);
      if (len > 1e-4) {
        dirX /= len;
        dirZ /= len;
      }

      // Smoothly rotate character towards movement direction
      const targetHeading = Math.atan2(dirX, dirZ);
      this.heading = angleLerp(this.heading, targetHeading, 12 * dt);

      // Horizontal displacement
      let nextX = this.x + dirX * speed * dt;
      let nextZ = this.z + dirZ * speed * dt;

      // Collisions against buildings
      for (let i = 0; i < colliders.length; i++) {
        const b = colliders[i];
        const test = circleIntersectsAABB(nextX, nextZ, this.collisionRadius, b.minX, b.minZ, b.maxX, b.maxZ);
        if (test.hit) {
          nextX += test.normalX * test.depth;
          nextZ += test.normalZ * test.depth;
        }
      }

      // City boundaries
      if (boundaries) {
        nextX = clamp(nextX, boundaries.minX + 1, boundaries.maxX - 1);
        nextZ = clamp(nextZ, boundaries.minZ + 1, boundaries.maxZ - 1);
      }

      this.x = nextX;
      this.z = nextZ;

      // Animate walking / running limbs
      const cycleSpeed = isSprinting ? 16 : 10;
      this.walkCycle += dt * cycleSpeed;
      const swing = Math.sin(this.walkCycle) * (isSprinting ? 0.75 : 0.45);

      this.leftLegPivot.rotation.x = swing;
      this.rightLegPivot.rotation.x = -swing;
      this.leftArmPivot.rotation.x = -swing * 0.8;
      this.rightArmPivot.rotation.x = swing * 0.8;
    } else {
      // Idle pose
      this.leftLegPivot.rotation.x = damp(this.leftLegPivot.rotation.x, 0, 10, dt);
      this.rightLegPivot.rotation.x = damp(this.rightLegPivot.rotation.x, 0, 10, dt);
      this.leftArmPivot.rotation.x = damp(this.leftArmPivot.rotation.x, 0, 10, dt);
      this.rightArmPivot.rotation.x = damp(this.rightArmPivot.rotation.x, 0, 10, dt);
    }

    // Jump & Vertical Gravity
    if (input.justPressed('space') && this.isGrounded) {
      this.vy = this.jumpForce;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.vy -= this.gravity * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    this.updateTransform();
  }

  stepDriving(dt, input, colliders, boundaries) {
    const v = this.vehicle;

    // Forward / reverse throttle
    let throttle = 0;
    if (input.isDown('forward')) throttle += 1;
    if (input.isDown('backward')) throttle -= 1;
    v.throttleInput = throttle;

    // Steering
    let steer = 0;
    if (input.isDown('left')) steer += 1;
    if (input.isDown('right')) steer -= 1;
    v.steerInput = steer;

    // Handbrake
    v.handbrake = input.isDown('space');

    // Step vehicle physics
    v.step(dt, colliders, boundaries);

    // Sync player position to vehicle
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.heading = v.heading;

    // Follow vehicle heading smoothly with camera yaw when driving
    if (Math.abs(v.speed) > 1.0) {
      const targetCamYaw = v.heading + Math.PI;
      this.camYaw = angleLerp(this.camYaw, targetCamYaw, 2.8 * dt);
    }
  }

  updateCamera(dt) {
    if (this.mode === 'foot') {
      const targetDist = this.camDistance;
      const targetH = this.camHeight;
      const targetY = this.y + 1.4;

      const camX = this.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * targetDist;
      const camY = Math.max(0.4, targetY + Math.sin(this.camPitch) * targetDist + targetH * 0.4);
      const camZ = this.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * targetDist;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(this.x, targetY, this.z);
    } else if (this.vehicle) {
      const v = this.vehicle;
      const speedRatio = Math.abs(v.speed) / v.config.maxSpeed;
      const driveDist = 8.5 + speedRatio * 3.0;
      const driveHeight = 3.2 + speedRatio * 0.8;

      const camX = v.x + Math.sin(this.camYaw) * Math.cos(this.camPitch) * driveDist;
      const camY = Math.max(0.8, v.y + driveHeight + Math.sin(this.camPitch) * driveDist * 0.5);
      const camZ = v.z + Math.cos(this.camYaw) * Math.cos(this.camPitch) * driveDist;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(v.x, v.y + 1.2, v.z);
    }
  }

  findNearestEnterableVehicle(vehicles) {
    let nearest = null;
    let minDistSq = 24.0; // Max enter distance ~4.9m

    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const dx = v.x - this.x;
      const dz = v.z - this.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearest = v;
      }
    }
    return nearest;
  }

  enterVehicle(vehicle) {
    this.mode = 'driving';
    this.vehicle = vehicle;
    vehicle.isOccupied = true;
    this.group.visible = false; // Hide on-foot model while in car
    this.camDistance = 8.5;
  }

  exitVehicle() {
    if (!this.vehicle) return;
    const exitPos = this.vehicle.getExitPosition();
    this.x = exitPos.x;
    this.y = 0;
    this.z = exitPos.z;

    this.vehicle.isOccupied = false;
    this.vehicle.throttleInput = 0;
    this.vehicle.steerInput = 0;
    this.vehicle.handbrake = false;
    this.vehicle = null;

    this.mode = 'foot';
    this.group.visible = true;
    this.camDistance = 5.4;
    this.updateTransform();
  }
}
