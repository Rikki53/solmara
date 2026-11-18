// Solmara game entrypoint: sets up Three.js WebGL scene, lighting, game loop, and core systems.
import * as THREE from 'three';
import { InputManager } from './input.js';
import { City } from './city.js';
import { Player } from './player.js';
import { Vehicle } from './vehicles.js';
import { TrafficManager } from './traffic.js';
import { PedestrianManager } from './pedestrians.js';
import { Hud } from './hud.js';
import { AudioManager } from './audio.js';
import { PoliceManager } from './police.js';
import { MissionManager } from './missions.js';
import { CombatSystem } from './combat.js';
import { SaveSystem } from './save.js';
import { stageShot } from './shots.js';
import { dist2D } from './utils.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.urlParams = new URLSearchParams(window.location.search);
    this.seed = parseInt(this.urlParams.get('seed') || '1', 10);
    this.shotParam = this.urlParams.get('shot');

    this.initRenderer();
    this.initScene();
    this.initLighting();
    this.initAudioAndSystems();
    this.initWorld();
    this.initHud();

    // If loaded from save
    const loadedData = this.saveSystem.loadGame();
    if (loadedData) {
      this.missionManager.money = loadedData.money;
      this.missionManager.startMission(loadedData.currentMissionIndex || 0);
      this.player.x = loadedData.playerX;
      this.player.z = loadedData.playerZ;
      this.player.updateTransform();
    } else {
      this.missionManager.startMission(0);
    }

    this.lastTime = performance.now();
    this.onResize = this.onResize.bind(this);
    this.animate = this.animate.bind(this);

    window.addEventListener('resize', this.onResize);
    this.onResize();

    this.gameState = this.shotParam ? 'playing' : 'title';

    // Check if running in screenshot staging mode
    if (this.shotParam) {
      stageShot(this.shotParam, this);
    } else {
      this.hud.showTitle();
    }

    // Wire menu events and keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this.gameState === 'title') {
        this.startGame();
      }
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (this.gameState === 'playing') {
          this.pauseGame();
        } else if (this.gameState === 'paused') {
          this.resumeGame();
        }
      }
    });

    setTimeout(() => {
      document.getElementById('hud-start-btn')?.addEventListener('click', () => this.startGame());
      document.getElementById('hud-resume-btn')?.addEventListener('click', () => this.resumeGame());
      document.getElementById('hud-restart-btn')?.addEventListener('click', () => window.location.reload());
      document.getElementById('hud-mute-btn')?.addEventListener('click', () => this.audio.toggleMute());
      document.getElementById('hud-splash-continue')?.addEventListener('click', () => this.hud.hideMissionComplete());
      document.getElementById('hud-gameover-restart')?.addEventListener('click', () => window.location.reload());
    }, 100);

    requestAnimationFrame(this.animate);
  }

  startGame() {
    this.gameState = 'playing';
    this.hud.hideTitle();
    if (this.audio && this.audio.ctx && this.audio.ctx.state === 'suspended') {
      this.audio.ctx.resume();
    }
  }

  pauseGame() {
    this.gameState = 'paused';
    this.hud.showPause();
  }

  resumeGame() {
    this.gameState = 'playing';
    this.hud.hidePause();
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

  initAudioAndSystems() {
    this.audio = new AudioManager();
    this.saveSystem = new SaveSystem();
  }

  initWorld() {
    this.input = new InputManager(this.canvas);
    this.city = new City(this.scene, this.seed);

    // Spawn player on Coral Avenue sidewalk
    this.player = new Player(this.scene, this.camera, 148, 15);

    // Systems
    this.policeManager = new PoliceManager(this.scene, this.city, this.audio);
    this.missionManager = new MissionManager(this.scene, this.city, this.audio);
    this.combatSystem = new CombatSystem(this.scene, this.audio);

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

    if (this.gameState === 'title') {
      // Gentle cinematic camera rotation on title screen
      this.player.camYaw += dt * 0.2;
      this.player.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    if (this.gameState === 'paused' || this.gameState === 'gameOver') {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Check Player Health for Game Over
    if (this.player.health <= 0) {
      this.gameState = 'gameOver';
      this.hud.showGameOver(false);
      return;
    }

    // Handle Mute Toggle
    if (this.input.justPressed('mute')) {
      this.audio.toggleMute();
    }

    // Handle Punch Action (F key)
    if (this.input.justPressed('action')) {
      this.combatSystem.triggerPunch(this.player, this.pedestrianManager, this.policeManager);
    }

    // Handle Quick Save (P key)
    if (this.input.justPressed('pause')) {
      this.saveSystem.saveGame({
        money: this.missionManager.money,
        currentMissionIndex: this.missionManager.currentMissionIndex,
        playerX: this.player.x,
        playerZ: this.player.z,
        muted: this.audio.isMuted,
      });
    }

    // 1. Update Traffic, Pedestrians, Police, Missions, Combat
    this.trafficManager.step(dt, this.player, this.city.colliders, this.boundaries);
    this.pedestrianManager.step(dt, this.player, this.trafficManager.vehicles);
    this.policeManager.step(dt, this.player, this.city.colliders, this.boundaries, this);
    this.missionManager.step(dt, this.player, this.policeManager);
    this.combatSystem.step(dt, this.player, this.pedestrianManager, this.policeManager);

    // Check Pay & Spray Garage (x: 35, z: 56)
    if (this.player.mode === 'driving' && this.player.vehicle) {
      const dGarage = dist2D(this.player.x, this.player.z, 35, 56);
      if (dGarage < 7.0 && this.policeManager.wantedLevel > 0 && this.missionManager.money >= 100) {
        this.missionManager.money -= 100;
        this.policeManager.setWantedLevel(0);
        this.player.vehicle.health = 100;
        if (this.audio) this.audio.playCrash(0.5);
      }
    }

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
      this.trafficManager.vehicles,
      this.policeManager,
      this.missionManager,
      this.combatSystem
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
