// Solmara game entrypoint: sets up Three.js WebGL scene, lighting, game loop, and core systems.
import * as THREE from 'three';
import { InputManager } from './input.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Vehicle } from './vehicles.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { Hud } from './hud.js';
import { stageShot } from './shots.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.urlParams = new URLSearchParams(window.location.search);
    this.seed = parseInt(this.urlParams.get('seed') || '1', 10);
    this.shotParam = this.urlParams.get('shot');

    this.initRenderer();
    this.initScene();
    this.initLighting();
    this.initWorld();
    this.initHud();

    this.lastTime = performance.now();
    this.onResize = this.onResize.bind(this);
    this.animate = this.animate.bind(this);

    window.addEventListener('resize', this.onResize);
    this.onResize();

    // Check if running in screenshot staging mode
    if (this.shotParam) {
      stageShot(this.shotParam, this);
    }

    requestAnimationFrame(this.animate);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
  }

  initScene() {
    this.scene = new THREE.Scene();

    // Warm golden hour sunset haze
    const sunsetColor = 0xf8a870;
    this.scene.background = new THREE.Color(sunsetColor);
    this.scene.fog = new THREE.Fog(sunsetColor, 90, 380);
  }

  initLighting() {
    // 1. Warm Golden Hour Directional Sunlight
    this.sunLight = new THREE.DirectionalLight(0xffdfa8, 1.8);
    this.sunLight.position.set(-160, 95, -120);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 400;
    const d = 90;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.scene.add(this.sunLight);

    // 2. Ambient Hemisphere Light: Sky Blue + Ground Bounce Warmth
    this.hemiLight = new THREE.HemisphereLight(0x8cd2ff, 0xdf9f68, 0.85);
    this.scene.add(this.hemiLight);

    // 3. Subtle ambient light for low-poly fill
    const ambientLight = new THREE.AmbientLight(0xffeedd, 0.35);
    this.scene.add(ambientLight);
  }

  initWorld() {
    this.input = new InputManager(this.canvas);
    this.city = new City(this.scene, this.seed);

    // Spawn player on Coral Avenue sidewalk
    this.player = new Player(this.scene, this.camera, 148, 15);

    // Spawn ambient traffic
    this.trafficManager = new TrafficManager(this.scene, this.city, this.seed + 10);

    // Park a luxury sports car right next to player spawn on Coral Avenue for immediate driving
    this.starterCar = new Vehicle(this.scene, 'sport', 143.5, 20, Math.PI, 0xd32f2f);
    this.trafficManager.vehicles.push(this.starterCar);

    // Spawn ambient pedestrians
    this.pedestrianManager = new PedestrianManager(this.scene, this.city, this.seed + 20);

    this.boundaries = {
      minX: this.city.minX,
      maxX: this.city.maxX,
      minZ: this.city.minZ,
      maxZ: this.city.maxZ,
    };
  }

  initHud() {
    const hudContainer = document.getElementById('hud-overlay') || document.body;
    this.hud = new Hud(hudContainer, this.city);
  }

  onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  animate(now) {
    requestAnimationFrame(this.animate);

    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // 1. Update Traffic & Pedestrians
    this.trafficManager.step(dt, this.player, this.city.colliders, this.boundaries);
    this.pedestrianManager.step(dt, this.player, this.trafficManager.vehicles);

    // 2. Update Player
    this.player.step(dt, this.input, this.city.colliders, this.boundaries, this.trafficManager.vehicles);

    // 3. Keep directional shadow camera focused near player
    this.sunLight.position.set(this.player.x - 120, 95, this.player.z - 90);
    this.sunLight.target.position.set(this.player.x, 0, this.player.z);
    this.sunLight.target.updateMatrixWorld();

    // 4. Update HUD
    this.hud.update(
      this.player,
      this.trafficManager,
      this.pedestrianManager.pedestrians,
      this.trafficManager.vehicles
    );

    // 5. Render Scene
    this.renderer.render(this.scene, this.camera);

    // 6. Reset per-frame input flags
    this.input.clearPressed();
  }
}

// Bootstrap game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.solmaraGame = new Game();
});
