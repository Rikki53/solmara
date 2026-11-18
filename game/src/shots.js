// Solmara screenshot staging module for deterministic scene framing via ?shot=street|drive|chase.
import { Vehicle } from './vehicles.js';

export function stageShot(name, game) {
  const { player, city, trafficManager, pedestrianManager, camera } = game;

  if (name === 'drive' || name === 'chase') {
    // 1. Stage Driving Shot on Coral Avenue at Golden Hour
    // Spawn player inside a red sports car heading North along Coral Avenue (X = 143.5, Z = 20)
    let car = null;
    for (const v of trafficManager.vehicles) {
      if (v.config.type === 'sport') {
        car = v;
        break;
      }
    }
    if (!car) {
      car = new Vehicle(game.scene, 'sport', 143.5, 30, Math.PI, 0xd32f2f);
      trafficManager.vehicles.push(car);
    }

    car.x = 143.5;
    car.z = 25;
    car.heading = Math.PI; // Heading North (-Z)
    car.speed = name === 'chase' ? 36.0 : 29.0; // ~65-80 MPH
    car.updateTransform();

    player.enterVehicle(car);
    player.camYaw = Math.PI * 0.95;
    player.camPitch = 0.22;

    // Position nearby traffic cars for visual depth
    if (trafficManager.vehicles.length >= 2) {
      const v2 = trafficManager.vehicles[1];
      v2.x = 136.5; // Opposite lane heading South
      v2.z = -15;
      v2.heading = 0;
      v2.speed = 12.0;
      v2.updateTransform();
    }
  } else {
    // 2. Stage Street / On-Foot Shot: Kai Marlow walking down Coral Avenue
    if (player.mode === 'driving') {
      player.exitVehicle();
    }

    player.x = 148.5; // Sidewalk on Coral Avenue
    player.y = 0;
    player.z = 10;
    player.heading = Math.PI * 0.92;
    player.camYaw = Math.PI * 0.88;
    player.camPitch = 0.18;
    player.updateTransform();

    // Position a parked luxury sports car nearby on the street
    const parkedCar = trafficManager.vehicles[0];
    if (parkedCar) {
      parkedCar.x = 143.5;
      parkedCar.z = 18;
      parkedCar.heading = Math.PI;
      parkedCar.speed = 0;
      parkedCar.updateTransform();
    }

    // Position pedestrians walking nearby
    if (pedestrianManager.pedestrians.length >= 2) {
      const p1 = pedestrianManager.pedestrians[0];
      p1.x = 148.2;
      p1.z = 24;
      p1.heading = 0;
      p1.group.position.set(p1.x, 0.22, p1.z);

      const p2 = pedestrianManager.pedestrians[1];
      p2.x = 149.0;
      p2.z = -6;
      p2.heading = Math.PI;
      p2.group.position.set(p2.x, 0.22, p2.z);
    }
  }

  // Update camera and HUD immediately for the staged frame
  player.updateCamera(0.016);
  game.hud.update(player, trafficManager, pedestrianManager.pedestrians, trafficManager.vehicles);
}
