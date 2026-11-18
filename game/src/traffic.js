// Solmara ambient traffic simulation: spawns, steers, and manages AI cars along road lanes.
import { Vehicle } from './vehicles.js';
import { dist2D, createRng } from './utils.js';

export class TrafficManager {
  constructor(scene, city, seed = 42) {
    this.scene = scene;
    this.city = city;
    this.rng = createRng(seed);

    this.vehicles = [];
    this.maxCars = 16;
    this.archetypes = ['sedan', 'sport', 'taxi', 'pickup'];

    this.spawnInitialTraffic();
  }

  spawnInitialTraffic() {
    const lanes = this.city.trafficLanes;
    if (!lanes || lanes.length === 0) return;

    for (let i = 0; i < this.maxCars; i++) {
      const lane = lanes[i % lanes.length];
      const archetype = this.archetypes[Math.floor(this.rng() * this.archetypes.length)];

      let x, z, heading;
      if (lane.type === 'NS') {
        x = lane.x;
        z = lane.minZ + this.rng() * (lane.maxZ - lane.minZ);
        heading = lane.dirZ > 0 ? 0 : Math.PI;
      } else {
        z = lane.z;
        x = lane.minX + this.rng() * (lane.maxX - lane.minX);
        heading = lane.dirX > 0 ? Math.PI / 2 : -Math.PI / 2;
      }

      const car = new Vehicle(this.scene, archetype, x, z, heading);
      car.isTraffic = true;
      car.targetSpeed = 11.0 + this.rng() * 6.0;
      car.lane = lane;
      this.vehicles.push(car);
    }
  }

  step(dt, player, colliders, boundaries) {
    const playerX = player.x;
    const playerZ = player.z;

    for (let i = 0; i < this.vehicles.length; i++) {
      const car = this.vehicles[i];

      // If this car is currently occupied by the player, skip AI logic
      if (car.isOccupied) continue;

      // Distance from player
      const distToPlayer = dist2D(car.x, car.z, playerX, playerZ);

      // Despawn / respawn car if too far from player (> 200m)
      if (distToPlayer > 220) {
        this.recycleCar(car, playerX, playerZ);
        continue;
      }

      // AI Driving behavior: check for obstacles ahead
      const obstacleDist = this.getDistanceToObstacleAhead(car, player);

      if (obstacleDist < 7.5) {
        // Full stop
        car.throttleInput = -0.5;
        car.steerInput = 0;
      } else if (obstacleDist < 16.0) {
        // Slow down
        car.throttleInput = 0.2;
        car.steerInput = 0;
      } else {
        // Cruise forward
        car.throttleInput = car.speed < car.targetSpeed ? 0.7 : 0.0;
        car.steerInput = 0;
      }

      // Step vehicle physics
      car.step(dt, colliders, boundaries);
    }
  }

  getDistanceToObstacleAhead(car, player) {
    let closest = 999;
    const fwdX = Math.sin(car.heading);
    const fwdZ = Math.cos(car.heading);

    // 1. Check distance to other traffic cars
    for (let j = 0; j < this.vehicles.length; j++) {
      const other = this.vehicles[j];
      if (other === car) continue;

      const toOtherX = other.x - car.x;
      const toOtherZ = other.z - car.z;

      // Dot product along forward heading
      const forwardProj = toOtherX * fwdX + toOtherZ * fwdZ;
      if (forwardProj > 0 && forwardProj < 24) {
        // Perpendicular offset from car heading ray
        const perpDist = Math.abs(toOtherX * (-fwdZ) + toOtherZ * fwdX);
        if (perpDist < 2.4) {
          if (forwardProj < closest) closest = forwardProj;
        }
      }
    }

    // 2. Check distance to player
    const toPlayerX = player.x - car.x;
    const toPlayerZ = player.z - car.z;
    const playerFwdProj = toPlayerX * fwdX + toPlayerZ * fwdZ;
    if (playerFwdProj > 0 && playerFwdProj < 24) {
      const perpDist = Math.abs(toPlayerX * (-fwdZ) + toPlayerZ * fwdX);
      if (perpDist < 2.4) {
        if (playerFwdProj < closest) closest = playerFwdProj;
      }
    }

    return closest;
  }

  recycleCar(car, playerX, playerZ) {
    const lanes = this.city.trafficLanes;
    const lane = lanes[Math.floor(this.rng() * lanes.length)];

    let rx, rz, rHeading;
    if (lane.type === 'NS') {
      rx = lane.x;
      rz = playerZ + (this.rng() > 0.5 ? 90 : -90) + (this.rng() - 0.5) * 40;
      rHeading = lane.dirZ > 0 ? 0 : Math.PI;
    } else {
      rz = lane.z;
      rx = playerX + (this.rng() > 0.5 ? 90 : -90) + (this.rng() - 0.5) * 40;
      rHeading = lane.dirX > 0 ? Math.PI / 2 : -Math.PI / 2;
    }

    car.x = rx;
    car.z = rz;
    car.heading = rHeading;
    car.speed = 8.0 + this.rng() * 4.0;
    car.lane = lane;
    car.updateTransform();
  }

  removeCar(car) {
    const idx = this.vehicles.indexOf(car);
    if (idx !== -1) {
      this.vehicles.splice(idx, 1);
    }
  }
}
