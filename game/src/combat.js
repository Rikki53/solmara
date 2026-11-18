// Solmara combat system: melee punches, health, pedestrian reactions, and damage handling.
import * as THREE from 'three';
import { dist2D } from './utils.js';

export class CombatSystem {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;

    // Player combat stats
    this.health = 100;
    this.maxHealth = 100;
    this.isDead = false;

    // Punch state
    this.isPunching = false;
    this.punchTimer = 0;
    this.punchCooldown = 0;
    this.punchRange = 3.2;
    this.punchDamage = 35;

    // Visual punch mesh / indicator if needed
    this.punchMesh = null;
  }

  step(dt, player, pedestrianManager, policeManager) {
    if (this.isDead) return;

    if (this.punchCooldown > 0) {
      this.punchCooldown -= dt;
    }

    if (this.isPunching) {
      this.punchTimer -= dt;
      if (this.punchTimer <= 0) {
        this.isPunching = false;
      }
    }

    // Health regen when out of combat
    if (this.health < this.maxHealth && this.health > 0) {
      this.health = Math.min(this.maxHealth, this.health + 1.5 * dt);
    }
  }

  triggerPunch(player, pedestrianManager, policeManager) {
    if (this.punchCooldown > 0 || this.isDead || player.mode !== 'foot') return;

    this.isPunching = true;
    this.punchTimer = 0.3; // Punch duration
    this.punchCooldown = 0.5; // Cooldown between punches

    // Play punch sound or whoosh
    if (this.audio) {
      this.audio.playCrash(0.2);
    }

    let hitSomething = false;
    const px = player.x;
    const pz = player.z;
    const forwardX = Math.sin(player.heading);
    const forwardZ = Math.cos(player.heading);

    // Check pedestrians
    if (pedestrianManager && pedestrianManager.pedestrians) {
      for (const ped of pedestrianManager.pedestrians) {
        if (ped.isFleeing && ped.health <= 0) continue;
        const d = dist2D(px, pz, ped.x, ped.z);
        if (d < this.punchRange) {
          // Check if roughly in front of player
          const toPedX = ped.x - px;
          const toPedZ = ped.z - pz;
          const dot = toPedX * forwardX + toPedZ * forwardZ;
          if (dot > 0) {
            ped.health = (ped.health || 100) - this.punchDamage;
            hitSomething = true;
            ped.isFleeing = true;
            ped.speed = 5.5; // Flee fast

            // Make pedestrian fall or stagger
            if (ped.group) {
              ped.group.rotation.x = Math.PI / 2;
              setTimeout(() => {
                if (ped.group) ped.group.rotation.x = 0;
              }, 1200);
            }

            // Report crime: assaulting pedestrian
            if (policeManager) {
              policeManager.reportCrime('punch', { x: px, z: pz });
            }
          }
        }
      }
    }

    // Check police foot officers
    if (policeManager && policeManager.footOfficers) {
      for (const officer of policeManager.footOfficers) {
        const d = dist2D(px, pz, officer.x, officer.z);
        if (d < this.punchRange) {
          officer.health = (officer.health || 100) - this.punchDamage;
          hitSomething = true;
          if (policeManager) {
            policeManager.reportCrime('policeAssault', { x: px, z: pz });
          }
        }
      }
    }

    if (hitSomething && this.audio) {
      this.audio.playCrash(0.5);
    }
  }

  takeDamage(amount, policeManager, player) {
    if (this.isDead) return;
    this.health = Math.max(0, this.health - amount);
    if (this.audio) {
      this.audio.playCrash(0.8);
    }

    if (this.health <= 0) {
      this.isDead = true;
      this.handleDeath(player, policeManager);
    }
  }

  handleDeath(player, policeManager) {
    if (policeManager) {
      policeManager.setWantedLevel(0);
    }
    // Respawn after 3 seconds at hospital / clinic location
    setTimeout(() => {
      this.health = this.maxHealth;
      this.isDead = false;
      if (player) {
        player.x = 100;
        player.z = 100;
        if (player.mode === 'driving' && player.currentVehicle) {
          player.exitVehicle();
        }
        player.updateTransform();
      }
    }, 3000);
  }
}
