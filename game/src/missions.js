// Solmara missions system: 5 story missions with markers, waypoint arrows, objectives, and cash rewards.
import * as THREE from 'three';
import { dist2D } from './utils.js';

export class MissionManager {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;

    this.money = 250; // Starting cash
    this.currentMissionIndex = 0;
    this.activeMission = null;
    this.missionState = 'idle'; // 'idle', 'active', 'success', 'failed'
    this.objectiveText = 'Explore Solmara or visit Rosa at the Garage to start First Wheels.';
    this.waypointPos = null; // {x, z}

    this.missions = [
      {
        id: 'm1',
        title: 'M1: First Wheels',
        client: 'Rosa Delgado',
        description: 'Steal any vehicle on Coral Avenue and deliver it safely to Rosa\'s Garage in Old Marina.',
        reward: 500,
        targetPos: { x: 35, z: 56 }, // Pay & Spray / Garage area
        radius: 8.0,
      },
      {
        id: 'm2',
        title: 'M2: Sunset Delivery',
        client: 'Mama Delgado',
        description: 'Take the package down to Dockside before the golden hour fades. Speed is key!',
        reward: 850,
        targetPos: { x: -80, z: -120 }, // Dockside
        radius: 10.0,
      },
      {
        id: 'm3',
        title: 'M3: Hot Pursuit',
        client: 'Anonymous Contact',
        description: 'Shake the Solmara Police department! Lose your 3-star wanted level and lay low.',
        reward: 1200,
        targetPos: null, // Evade wanted level
        radius: 0,
      },
      {
        id: 'm4',
        title: 'M4: The Pickup',
        client: 'Dockside Informant',
        description: 'Collect the cargo crate on Coral Avenue while avoiding police patrols.',
        reward: 1500,
        targetPos: { x: 120, z: -40 },
        radius: 8.0,
      },
      {
        id: 'm5',
        title: 'M5: Bay Heist',
        client: 'Rosa Delgado',
        description: 'The final job. Steal the secure container truck from the Bay Docks and deliver it to the hideout.',
        reward: 3500,
        targetPos: { x: -110, z: 130 },
        radius: 12.0,
      },
    ];

    // Create 3D Mission Marker Beacon Mesh
    this.createMarkerMesh();
  }

  createMarkerMesh() {
    this.markerGroup = new THREE.Group();
    
    // Glowing vertical cylinder / beam
    const geo = new THREE.CylinderGeometry(2.5, 2.5, 12, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffbe53,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    this.beamMesh = new THREE.Mesh(geo, mat);
    this.beamMesh.position.y = 6;
    this.markerGroup.add(this.beamMesh);

    // Floating ring on top
    const ringGeo = new THREE.RingGeometry(2.0, 2.8, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe082, side: THREE.DoubleSide });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.ringMesh.position.y = 0.5;
    this.markerGroup.add(this.ringMesh);

    this.markerGroup.visible = false;
    this.scene.add(this.markerGroup);
  }

  startMission(index) {
    if (index >= this.missions.length) {
      this.objectiveText = 'All story missions completed! Enjoy free roam in Solmara.';
      this.activeMission = null;
      this.markerGroup.visible = false;
      return;
    }

    this.currentMissionIndex = index;
    this.activeMission = this.missions[index];
    this.missionState = 'active';
    this.objectiveText = `${this.activeMission.title}: ${this.activeMission.description}`;
    
    if (this.activeMission.targetPos) {
      this.waypointPos = { ...this.activeMission.targetPos };
      this.markerGroup.position.set(this.waypointPos.x, 0, this.waypointPos.z);
      this.markerGroup.visible = true;
    } else {
      this.waypointPos = null;
      this.markerGroup.visible = false;
    }

    if (this.audio) {
      this.audio.playCrash(0.3); // chime/bell
    }
  }

  step(dt, player, policeManager) {
    if (this.missionState !== 'active' || !this.activeMission) return;

    // Rotate marker ring for visual polish
    if (this.markerGroup.visible) {
      this.ringMesh.rotation.z += dt * 1.5;
    }

    // Check M3 (Hot Pursuit): evade wanted level 3
    if (this.activeMission.id === 'm3') {
      if (policeManager && policeManager.wantedLevel === 0) {
        this.completeMission();
      }
      return;
    }

    // Check target position arrival
    if (this.waypointPos) {
      const d = dist2D(player.x, player.z, this.waypointPos.x, this.waypointPos.z);
      if (d <= this.activeMission.radius) {
        // Special check for M1: must be in a vehicle or delivered car
        if (this.activeMission.id === 'm1' && player.mode !== 'driving') {
          this.objectiveText = `${this.activeMission.title}: Get into a vehicle and bring it to the garage!`;
          return;
        }
        this.completeMission();
      }
    }
  }

  completeMission() {
    if (!this.activeMission) return;
    this.missionState = 'success';
    this.money += this.activeMission.reward;
    this.objectiveText = `MISSION SUCCESS! Reward: $${this.activeMission.reward}. Starting next mission...`;
    this.markerGroup.visible = false;

    if (this.audio) {
      this.audio.playCrash(0.6);
    }

    setTimeout(() => {
      this.currentMissionIndex++;
      this.startMission(this.currentMissionIndex);
    }, 3500);
  }
}
