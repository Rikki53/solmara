// Solmara wanted level system & police AI: patrol cruisers, foot officers, line-of-sight detection, and Pay & Spray garage.
import * as THREE from 'three';
import { Vehicle } from './vehicles.js';
import { dist2D, distSq2D, clamp, angleLerp, damp, normalizeAngle } from './utils.js';

export class PoliceManager {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;

    // Wanted state
    this.wantedLevel = 0; // 0 to 5
    this.isPlayerSeen = false;
    this.hiddenTimer = 0;
    this.hiddenDurationNeeded = 12.0; // Seconds hidden before wanted drops
    this.lastSeenPos = { x: 0, z: 0 };
    this.crimeCooldown = 0;

    // Police fleet
    this.policeCars = [];
    this.footOfficers = [];
    this.maxCars = 4;
    this.maxFootOfficers = 4;

    // Light flashing timer for siren beacons
    this.sirenFlashTimer = 0;
    this.sirenFlashState = false;

    // Pay & Spray garage location and 3D structure
    this.payAndSpray = {
      x: 35,
      z: 56,
      radius: 6.5,
      cost: 100,
    };
    this.createPayAndSprayGarage();

    // Group for foot officers
    this.footGroup = new THREE.Group();
    this.scene.add(this.footGroup);
  }

  createPayAndSprayGarage() {
    this.garageGroup = new THREE.Group();
    this.garageGroup.position.set(this.payAndSpray.x, 0, this.payAndSpray.z);

    // Garage workshop building
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x3a404d });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }); // Golden yellow trim
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x22262e });

    // Back & side walls
    const wallGeo = new THREE.BoxGeometry(12, 5.5, 10);
    const garageBuilding = new THREE.Mesh(wallGeo, wallMat);
    garageBuilding.position.set(0, 2.75, -2.5);
    garageBuilding.castShadow = true;
    this.garageGroup.add(garageBuilding);

    // Awning over bay entrance
    const awningGeo = new THREE.BoxGeometry(13, 0.4, 5);
    const awning = new THREE.Mesh(awningGeo, trimMat);
    awning.position.set(0, 5.0, 3.5);
    this.garageGroup.add(awning);

    // Signboard
    const signGeo = new THREE.BoxGeometry(8, 1.4, 0.3);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.2 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 5.8, 4.2);
    this.garageGroup.add(sign);

    // Glowing Neon letters / accent on sign
    const neonGeo = new THREE.BoxGeometry(7.4, 0.5, 0.35);
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xffbe53 });
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.set(0, 5.8, 4.22);
    this.garageGroup.add(neon);

    // Glowing entrance pad (spray zone)
    const padGeo = new THREE.PlaneGeometry(9, 7);
    const padMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    this.padMesh = new THREE.Mesh(padGeo, padMat);
    this.padMesh.rotation.x = -Math.PI / 2;
    this.padMesh.position.set(0, 0.05, 3.0);
    this.garageGroup.add(this.padMesh);

    // Add garage building to city colliders so cars can't clip through rear
    this.city.colliders.push({
      minX: this.payAndSpray.x - 6,
      maxX: this.payAndSpray.x + 6,
      minZ: this.payAndSpray.z - 7.5,
      maxZ: this.payAndSpray.z + 2.5,
    });

    this.scene.add(this.garageGroup);
  }

  /** Triggers a crime report, raising wanted level up to 5. */
  reportCrime(crimeType, location) {
    let starGain = 1;
    if (crimeType === 'carjack') starGain = 1;
    if (crimeType === 'hitPedestrian') starGain = 1;
    if (crimeType === 'punch') starGain = 1;
    if (crimeType === 'policeAssault' || crimeType === 'ramCop') starGain = 2;

    const oldWanted = this.wantedLevel;
    this.wantedLevel = clamp(this.wantedLevel + starGain, 1, 5);
    this.isPlayerSeen = true;
    this.hiddenTimer = 0;
    this.lastSeenPos = { x: location.x, z: location.z };

    // Spawn immediate police response if none present
    if (oldWanted === 0 && this.policeCars.length === 0) {
      this.spawnPoliceCarNear(location.x, location.z);
    }
  }

  setWantedLevel(level) {
    this.wantedLevel = clamp(level, 0, 5);
    this.hiddenTimer = 0;
    if (this.wantedLevel > 0) {
      this.isPlayerSeen = true;
    } else {
      this.isPlayerSeen = false;
      this.dismissPolice();
    }
  }

  dismissPolice() {
    for (const car of this.policeCars) {
      car.dispose();
    }
    this.policeCars = [];

    for (const officer of this.footOfficers) {
      this.footGroup.remove(officer.group);
    }
    this.footOfficers = [];

    if (this.audio) {
      this.audio.setSiren(false);
    }
  }

  spawnPoliceCarNear(playerX, playerZ) {
    // Choose spawn lane ~70-90m away from player
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = 75;
    const sx = playerX + Math.sin(spawnAngle) * spawnDist;
    const sz = playerZ + Math.cos(spawnAngle) * spawnDist;

    const copCar = new Vehicle(this.scene, 'sedan', sx, sz, spawnAngle + Math.PI, 0x1e293b); // Deep police navy/black
    copCar.isPolice = true;
    copCar.targetSpeed = 28.0 + this.wantedLevel * 3.0;

    // Attach flashing lightbar to roof
    this.addLightbarToPoliceCar(copCar);

    this.policeCars.push(copCar);
  }

  addLightbarToPoliceCar(car) {
    const lightbarGroup = new THREE.Group();
    lightbarGroup.position.set(0, 1.45, 0);

    const baseGeo = new THREE.BoxGeometry(1.4, 0.12, 0.35);
    const baseMat = new THREE.MeshLambertMaterial({ color: 0x111827 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    lightbarGroup.add(base);

    // Left Red Beacon
    const redGeo = new THREE.BoxGeometry(0.55, 0.16, 0.32);
    car.redSirenMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
    const redBeacon = new THREE.Mesh(redGeo, car.redSirenMat);
    redBeacon.position.set(-0.35, 0.12, 0);
    lightbarGroup.add(redBeacon);

    // Right Blue Beacon
    const blueGeo = new THREE.BoxGeometry(0.55, 0.16, 0.32);
    car.blueSirenMat = new THREE.MeshBasicMaterial({ color: 0x1e66ff });
    const blueBeacon = new THREE.Mesh(blueGeo, car.blueSirenMat);
    blueBeacon.position.set(0.35, 0.12, 0);
    lightbarGroup.add(blueBeacon);

    car.group.add(lightbarGroup);
  }

  spawnFootOfficer(x, z) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // Police uniform materials
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a, flatShading: true }); // Police navy
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x0f172a, flatShading: true }); // Midnight dark pants
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd49b70 });
    const badgeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 }); // Gold badge
    const capMat = new THREE.MeshLambertMaterial({ color: 0x1e3a8a });

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.52, 0.7, 0.3);
    const torso = new THREE.Mesh(torsoGeo, uniformMat);
    torso.position.y = 1.2;
    torso.castShadow = true;
    group.add(torso);

    // Gold badge on chest
    const badgeGeo = new THREE.BoxGeometry(0.12, 0.14, 0.04);
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    badge.position.set(0.14, 0.15, 0.16);
    torso.add(badge);

    // Head
    const headGeo = new THREE.BoxGeometry(0.3, 0.32, 0.28);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 0.52;
    torso.add(head);

    // Police Hat / Cap
    const capGeo = new THREE.BoxGeometry(0.36, 0.14, 0.38);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.2;
    head.add(cap);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.56, 0.16);
    const leftArmPivot = new THREE.Group();
    leftArmPivot.position.set(-0.34, 0.26, 0);
    const leftArm = new THREE.Mesh(armGeo, uniformMat);
    leftArm.position.y = -0.24;
    leftArmPivot.add(leftArm);
    torso.add(leftArmPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.position.set(0.34, 0.26, 0);
    const rightArm = new THREE.Mesh(armGeo, uniformMat);
    rightArm.position.y = -0.24;
    rightArmPivot.add(rightArm);
    torso.add(rightArmPivot);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.66, 0.2);
    const leftLegPivot = new THREE.Group();
    leftLegPivot.position.set(-0.15, 0.85, 0);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.y = -0.32;
    leftLegPivot.add(leftLeg);
    group.add(leftLegPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.position.set(0.15, 0.85, 0);
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.y = -0.32;
    rightLegPivot.add(rightLeg);
    group.add(rightLegPivot);

    this.footGroup.add(group);

    return {
      group,
      leftArmPivot,
      rightArmPivot,
      leftLegPivot,
      rightLegPivot,
      x,
      z,
      heading: 0,
      speed: 6.8, // Sprint pursuit speed
      walkCycle: 0,
      isAttacking: false,
    };
  }

  /** Main police update tick. */
  step(dt, player, colliders, boundaries, game) {
    // 1. Check Pay & Spray Garage Interaction
    this.checkPayAndSpray(player, game);

    // 2. Animate garage entrance glow
    if (this.padMesh) {
      this.padMesh.material.opacity = 0.25 + Math.sin(performance.now() * 0.005) * 0.15;
    }

    // 3. Siren Flash Animation
    this.sirenFlashTimer += dt;
    if (this.sirenFlashTimer > 0.12) {
      this.sirenFlashTimer = 0;
      this.sirenFlashState = !this.sirenFlashState;
      const redCol = this.sirenFlashState ? 0xff0000 : 0x440000;
      const blueCol = this.sirenFlashState ? 0x002244 : 0x0066ff;

      for (const car of this.policeCars) {
        if (car.redSirenMat && car.blueSirenMat) {
          car.redSirenMat.color.setHex(redCol);
          car.blueSirenMat.color.setHex(blueCol);
        }
      }
    }

    // If no wanted level, update passive patrol and decay
    if (this.wantedLevel === 0) {
      if (this.audio) this.audio.setSiren(false);
      this.updatePassivePolice(dt, player, colliders, boundaries);
      return;
    }

    // 4. Update Line-of-Sight & Seen Status
    this.updateLineOfSight(player, colliders);

    // 5. Update Siren Sound
    if (this.audio) {
      const isAnyCarNear = this.policeCars.some((c) => dist2D(c.x, c.z, player.x, player.z) < 120);
      this.audio.setSiren(isAnyCarNear && this.wantedLevel > 0, this.wantedLevel / 3.0);
    }

    // 6. Manage Police Car Spawning / Reinforcements
    const targetCars = Math.min(this.maxCars, Math.max(1, this.wantedLevel));
    if (this.policeCars.length < targetCars && Math.random() < 0.02) {
      this.spawnPoliceCarNear(player.x, player.z);
    }

    // 7. Manage Foot Police Spawning at higher wanted levels (Level 3+)
    const targetFoot = this.wantedLevel >= 3 ? Math.min(this.maxFootOfficers, this.wantedLevel - 1) : 0;
    if (this.footOfficers.length < targetFoot && Math.random() < 0.015) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 20;
      const ox = player.x + Math.sin(angle) * dist;
      const oz = player.z + Math.cos(angle) * dist;
      this.footOfficers.push(this.spawnFootOfficer(ox, oz));
    }

    // 8. Update Police Patrol Cars AI
    this.updatePoliceCarsAI(dt, player, colliders, boundaries, game);

    // 9. Update Foot Officers AI
    this.updateFootOfficersAI(dt, player, colliders, game);

    // 10. Wanted Level Decay / Cooldown when hidden
    if (!this.isPlayerSeen) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer >= this.hiddenDurationNeeded) {
        this.hiddenTimer = 0;
        this.wantedLevel = Math.max(0, this.wantedLevel - 1);
        if (this.wantedLevel === 0) {
          this.dismissPolice();
        }
      }
    } else {
      this.hiddenTimer = 0;
      this.lastSeenPos = { x: player.x, z: player.z };
    }
  }

  updateLineOfSight(player, colliders) {
    let seen = false;
    const px = player.x;
    const pz = player.z;

    // Check line of sight from police cars
    for (const car of this.policeCars) {
      const d = dist2D(car.x, car.z, px, pz);
      if (d < 55.0) {
        if (!this.isLineBlockedByBuildings(car.x, car.z, px, pz, colliders)) {
          seen = true;
          break;
        }
      }
    }

    // Check line of sight from foot officers
    if (!seen) {
      for (const officer of this.footOfficers) {
        const d = dist2D(officer.x, officer.z, px, pz);
        if (d < 38.0) {
          if (!this.isLineBlockedByBuildings(officer.x, officer.z, px, pz, colliders)) {
            seen = true;
            break;
          }
        }
      }
    }

    this.isPlayerSeen = seen;
  }

  isLineBlockedByBuildings(x1, z1, x2, z2, colliders) {
    // Ray segment intersection check with building AABBs
    const minRayX = Math.min(x1, x2);
    const maxRayX = Math.max(x1, x2);
    const minRayZ = Math.min(z1, z2);
    const maxRayZ = Math.max(z1, z2);

    for (let i = 0; i < colliders.length; i++) {
      const b = colliders[i];
      // Fast AABB broadphase
      if (maxRayX < b.minX || minRayX > b.maxX || maxRayZ < b.minZ || minRayZ > b.maxZ) {
        continue;
      }
      // Line vs Box intersection
      if (this.segmentIntersectsAABB(x1, z1, x2, z2, b)) {
        return true;
      }
    }
    return false;
  }

  segmentIntersectsAABB(x1, z1, x2, z2, box) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    let tmin = 0;
    let tmax = 1;

    if (Math.abs(dx) > 1e-6) {
      let t1 = (box.minX - x1) / dx;
      let t2 = (box.maxX - x1) / dx;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    } else {
      if (x1 < box.minX || x1 > box.maxX) return false;
    }

    if (Math.abs(dz) > 1e-6) {
      let t1 = (box.minZ - z1) / dz;
      let t2 = (box.maxZ - z1) / dz;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    } else {
      if (z1 < box.minZ || z1 > box.maxZ) return false;
    }

    return true;
  }

  updatePoliceCarsAI(dt, player, colliders, boundaries, game) {
    const targetX = this.isPlayerSeen ? player.x : this.lastSeenPos.x;
    const targetZ = this.isPlayerSeen ? player.z : this.lastSeenPos.z;

    for (let i = this.policeCars.length - 1; i >= 0; i--) {
      const car = this.policeCars[i];
      const dist = dist2D(car.x, car.z, player.x, player.z);

      // Despawn car if too distant (> 240m)
      if (dist > 250) {
        car.dispose();
        this.policeCars.splice(i, 1);
        continue;
      }

      // Calculate pursuit steering angle
      const dx = targetX - car.x;
      const dz = targetZ - car.z;
      const targetHeading = Math.atan2(dx, dz);
      const angleDiff = normalizeAngle(targetHeading - car.heading);

      // Steer aggressively toward player
      car.steerInput = clamp(angleDiff * 2.5, -1.0, 1.0);

      // Throttle & Ramming Behavior
      const maxPursuitSpeed = 26.0 + this.wantedLevel * 3.5;
      if (Math.abs(angleDiff) < 0.6) {
        // Line-of-sight aligned: full throttle ramming!
        car.throttleInput = car.speed < maxPursuitSpeed ? 1.0 : 0.0;
        car.handbrake = false;
      } else if (Math.abs(angleDiff) > 1.8 && car.speed > 12.0) {
        // Sharp turn: handbrake drift
        car.throttleInput = 0.2;
        car.handbrake = true;
      } else {
        car.throttleInput = 0.7;
        car.handbrake = false;
      }

      // Step vehicle physics
      car.step(dt, colliders, boundaries);

      // Check collision/ram against player vehicle
      if (player.mode === 'driving' && player.vehicle) {
        const carDist = dist2D(car.x, car.z, player.vehicle.x, player.vehicle.z);
        if (carDist < 4.2) {
          // Ram impact!
          if (this.audio) this.audio.playCrash(1.2);
          player.vehicle.speed *= 0.7;
          player.health = Math.max(0, player.health - 6 * dt);
        }
      } else if (player.mode === 'foot') {
        const footDist = dist2D(car.x, car.z, player.x, player.z);
        if (footDist < 2.5 && Math.abs(car.speed) > 4.0) {
          // Hit player on foot!
          if (this.audio) this.audio.playCrash(0.8);
          player.health = Math.max(0, player.health - 25);
          player.x += Math.sin(car.heading) * 3.0;
          player.z += Math.cos(car.heading) * 3.0;
        }
      }
    }
  }

  updateFootOfficersAI(dt, player, colliders, game) {
    const targetX = this.isPlayerSeen ? player.x : this.lastSeenPos.x;
    const targetZ = this.isPlayerSeen ? player.z : this.lastSeenPos.z;

    for (let i = this.footOfficers.length - 1; i >= 0; i--) {
      const officer = this.footOfficers[i];
      const dist = dist2D(officer.x, officer.z, player.x, player.z);

      if (dist > 160) {
        this.footGroup.remove(officer.group);
        this.footOfficers.splice(i, 1);
        continue;
      }

      // Pursue player
      const dx = targetX - officer.x;
      const dz = targetZ - officer.z;
      const targetHeading = Math.atan2(dx, dz);
      officer.heading = angleLerp(officer.heading, targetHeading, 6.0 * dt);

      // Move toward target
      if (dist > 1.6) {
        officer.x += Math.sin(officer.heading) * officer.speed * dt;
        officer.z += Math.cos(officer.heading) * officer.speed * dt;

        // Limb sprint animation
        officer.walkCycle += dt * 14.0;
        const swing = Math.sin(officer.walkCycle) * 0.75;
        officer.leftLegPivot.rotation.x = swing;
        officer.rightLegPivot.rotation.x = -swing;
        officer.leftArmPivot.rotation.x = -swing * 0.8;
        officer.rightArmPivot.rotation.x = swing * 0.8;
      } else {
        // Close range melee arrest attack on foot player
        if (player.mode === 'foot') {
          player.health = Math.max(0, player.health - 12 * dt);
          if (this.audio && Math.random() < 0.08) {
            this.audio.playImpact();
          }
        }
      }

      officer.group.position.set(officer.x, 0.22, officer.z);
      officer.group.rotation.y = officer.heading;
    }
  }

  updatePassivePolice(dt, player, colliders, boundaries) {
    // If police cars exist while wanted level is 0, they gently patrol
    for (let i = this.policeCars.length - 1; i >= 0; i--) {
      const car = this.policeCars[i];
      car.throttleInput = car.speed < 10.0 ? 0.5 : 0;
      car.steerInput = 0;
      car.step(dt, colliders, boundaries);

      if (dist2D(car.x, car.z, player.x, player.z) > 180) {
        car.dispose();
        this.policeCars.splice(i, 1);
      }
    }
  }

  checkPayAndSpray(player, game) {
    const distToGarage = dist2D(player.x, player.z, this.payAndSpray.x, this.payAndSpray.z + 3.0);
    if (distToGarage < this.payAndSpray.radius) {
      // Player is inside the Pay & Spray garage!
      if (this.wantedLevel > 0 || (player.vehicle && player.vehicle.isDamaged)) {
        const playerMoney = game.saveManager ? game.saveManager.money : 500;
        const cost = this.payAndSpray.cost;

        if (playerMoney >= cost || this.wantedLevel > 0) {
          // Clear wanted level
          this.wantedLevel = 0;
          this.isPlayerSeen = false;
          this.hiddenTimer = 0;
          this.dismissPolice();

          // Deduct money
          if (game.saveManager) {
            game.saveManager.spendMoney(Math.min(playerMoney, cost));
          }

          // Repaint vehicle to fresh color
          if (player.vehicle) {
            const freshColors = [0x10b981, 0x3b82f6, 0xef4444, 0xf59e0b, 0x8b5cf6, 0xffffff];
            const newColor = freshColors[Math.floor(Math.random() * freshColors.length)];
            player.vehicle.color = newColor;
            player.vehicle.buildMesh();
          }

          if (this.audio) {
            this.audio.playChime('success');
          }

          if (game.hud) {
            game.hud.showNotification('PAY & SPRAY: WANTED CLEARED & REPAIRED (-$100)');
          }
        }
      }
    }
  }
}
