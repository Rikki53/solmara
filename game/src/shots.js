// Solmara screenshot staging module for deterministic scene framing via ?shot=street|drive|chase|mission.
import { Vehicle } from './vehicles.js';

export function stageShot(name, game) {
  const { player, city, trafficManager, pedestrianManager, policeManager, missionManager, camera } = game;

  if (name === 'chase') {
    // 1. Stage Police Chase Shot: wanted level 3, police car behind player
    if (policeManager) {
      policeManager.setWantedLevel(3);
      policeManager.spawnPoliceCarNear(player.x, player.z);
    }

    let car = null;
    for (const v of trafficManager.vehicles) {
      if (v.config.type === 'sport') {
        car = v;
        break;
      }
    }
    if (!car) {
      car = new Vehicle(game.scene, 'sport', 143.5, 20, Math.PI, 0xd32f2f);
      trafficManager.vehicles.push(car);
    }

    car.x = 143.5;
    car.z = 20;
    car.heading = Math.PI;
    car.speed = 34.0;
    car.updateTransform();

    player.enterVehicle(car);
    player.camYaw = Math.PI * 0.98;
    player.camPitch = 0.2;

    // Spawn police car directly behind player
    if (policeManager && policeManager.policeCars.length > 0) {
      const cop = policeManager.policeCars[0];
      cop.x = 143.5;
      cop.z = 38;
      cop.heading = Math.PI;
      cop.speed = 36.0;
      cop.updateTransform();
    }
  } else if (name === 'mission') {
    // 2. Stage Mission In Progress
    if (missionManager) {
      missionManager.startMission(0); // M1 First Wheels
    }

    let car = null;
    for (const v of trafficManager.vehicles) {
      if (v.config.type === 'sport') {
        car = v;
        break;
      }
    }
    if (!car) {
      car = new Vehicle(game.scene, 'sport', 143.5, 20, Math.PI, 0xd32f2f);
      trafficManager.vehicles.push(car);
    }

    player.x = 148.5;
    player.z = 15;
    player.heading = Math.PI * 0.9;
    player.camYaw = Math.PI * 0.85;
    player.camPitch = 0.25;
    player.updateTransform();
  } else if (name === 'drive') {
    let car = null;
    for (const v of trafficManager.vehicles) {
      if (v.config.type === 'sport') {
        car = v;
        break;
      }
    }
    if (!car) {
      car = new Vehicle(game.scene, 'sport', 143.5, 20, Math.PI, 0xd32f2f);
      trafficManager.vehicles.push(car);
    }

    car.x = 143.5;
    car.z = 25;
    car.heading = Math.PI;
    car.speed = 29.0;
    car.updateTransform();

    player.enterVehicle(car);
    player.camYaw = Math.PI * 0.95;
    player.camPitch = 0.22;
  } else {
    // street shot
    if (player.mode === 'driving') {
      player.exitVehicle();
    }

    player.x = 148.5;
    player.y = 0;
    player.z = 10;
    player.heading = Math.PI * 0.92;
    player.camYaw = Math.PI * 0.88;
    player.camPitch = 0.18;
    player.updateTransform();
  }

  // Update camera and HUD immediately for the staged frame
  player.updateCamera(0.016);
  game.hud.update(
    player,
    trafficManager,
    pedestrianManager.pedestrians,
    trafficManager.vehicles,
    policeManager,
    missionManager,
    game.combatSystem
  );
}
