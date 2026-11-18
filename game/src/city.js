// Solmara procedural city generator: streets, buildings, palms, beach, ocean, and district zones.
import * as THREE from 'three';
import { DISTRICTS, createRng } from './utils.js';

export class City {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = createRng(seed);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Collision boxes for buildings and static obstacles
    this.colliders = [];

    // Road network definitions for traffic and navigation
    this.roads = [];
    this.intersections = [];
    this.trafficLanes = [];
    this.sidewalkNodes = [];

    // World layout metrics
    this.gridSpacing = 70; // Distance between street centerlines
    this.roadWidth = 14;   // Asphalt width
    this.sidewalkWidth = 4; // Sidewalk width on each side
    this.halfRoad = this.roadWidth / 2;

    // Grid coordinates
    this.xRoads = [-210, -140, -70, 0, 70, 140];
    this.zRoads = [-210, -140, -70, 0, 70, 140, 210];

    this.minX = -260;
    this.maxX = 360;
    this.minZ = -260;
    this.maxZ = 260;

    this.buildWorld();
  }

  buildWorld() {
    this.createGroundAndOcean();
    this.createRoadNetwork();
    this.createCityBlocks();
    this.createBeachAndPier();
    this.createStreetFurniture();
  }

  /** Ocean plane and sandy coastline on the eastern edge. */
  createGroundAndOcean() {
    // City ground base (concrete/soil)
    const groundGeo = new THREE.PlaneGeometry(500, 600);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x82847c });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(-60, -0.05, 0);
    ground.receiveShadow = true;
    this.group.add(ground);

    // Sandy beach plane (X from 155 to 260)
    const beachGeo = new THREE.PlaneGeometry(120, 600);
    const beachMat = new THREE.MeshLambertMaterial({ color: 0xe5cc96 });
    const beach = new THREE.Mesh(beachGeo, beachMat);
    beach.rotation.x = -Math.PI / 2;
    beach.position.set(215, -0.02, 0);
    beach.receiveShadow = true;
    this.group.add(beach);

    // Ocean water plane (X from 250 to 800)
    const oceanGeo = new THREE.PlaneGeometry(550, 800);
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x1d7ca8,
      roughness: 0.1,
      metalness: 0.6,
      transparent: true,
      opacity: 0.88,
    });
    this.ocean = new THREE.Mesh(oceanGeo, oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(525, -0.4, 0);
    this.group.add(this.ocean);
  }

  /** Creates asphalt roads, painted road markings, and elevated sidewalks. */
  createRoadNetwork() {
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3035 });
    const markMatYellow = new THREE.MeshBasicMaterial({ color: 0xf4c242 });
    const markMatWhite = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xbdbcb5 });

    // 1. North-South Avenues
    for (const rx of this.xRoads) {
      const roadGeo = new THREE.PlaneGeometry(this.roadWidth, this.maxZ - this.minZ);
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rx, 0.01, 0);
      road.receiveShadow = true;
      this.group.add(road);

      // Yellow double center line
      const lineGeo = new THREE.PlaneGeometry(0.3, this.maxZ - this.minZ);
      const lineL = new THREE.Mesh(lineGeo, markMatYellow);
      lineL.rotation.x = -Math.PI / 2;
      lineL.position.set(rx - 0.25, 0.02, 0);
      const lineR = new THREE.Mesh(lineGeo, markMatYellow);
      lineR.rotation.x = -Math.PI / 2;
      lineR.position.set(rx + 0.25, 0.02, 0);
      this.group.add(lineL);
      this.group.add(lineR);

      // White dashed lane markings
      const dashCount = Math.floor((this.maxZ - this.minZ) / 8);
      for (let i = 0; i < dashCount; i++) {
        const z = this.minZ + i * 8 + 4;
        const dashGeo = new THREE.PlaneGeometry(0.25, 3.5);
        const dashL = new THREE.Mesh(dashGeo, markMatWhite);
        dashL.rotation.x = -Math.PI / 2;
        dashL.position.set(rx - 3.5, 0.02, z);
        const dashR = new THREE.Mesh(dashGeo, markMatWhite);
        dashR.rotation.x = -Math.PI / 2;
        dashR.position.set(rx + 3.5, 0.02, z);
        this.group.add(dashL);
        this.group.add(dashR);
      }

      // Traffic lanes for AI: lane heading south (+Z) at rx + 3.5, lane heading north (-Z) at rx - 3.5
      this.trafficLanes.push({
        type: 'NS',
        x: rx + 3.5,
        dirZ: 1,
        minZ: this.minZ,
        maxZ: this.maxZ,
      });
      this.trafficLanes.push({
        type: 'NS',
        x: rx - 3.5,
        dirZ: -1,
        minZ: this.minZ,
        maxZ: this.maxZ,
      });
    }

    // 2. East-West Cross Streets
    for (const rz of this.zRoads) {
      const roadGeo = new THREE.PlaneGeometry(this.xRoads[this.xRoads.length - 1] - this.minX + this.halfRoad, this.roadWidth);
      const centerX = (this.minX + this.xRoads[this.xRoads.length - 1]) / 2;
      const road = new THREE.Mesh(roadGeo, roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(centerX, 0.015, rz);
      road.receiveShadow = true;
      this.group.add(road);

      // Yellow double center line
      const lineGeo = new THREE.PlaneGeometry(this.xRoads[this.xRoads.length - 1] - this.minX + this.halfRoad, 0.3);
      const lineT = new THREE.Mesh(lineGeo, markMatYellow);
      lineT.rotation.x = -Math.PI / 2;
      lineT.position.set(centerX, 0.022, rz - 0.25);
      const lineB = new THREE.Mesh(lineGeo, markMatYellow);
      lineB.rotation.x = -Math.PI / 2;
      lineB.position.set(centerX, 0.022, rz + 0.25);
      this.group.add(lineT);
      this.group.add(lineB);

      // Traffic lanes for AI: lane heading east (+X) at rz - 3.5, lane heading west (-X) at rz + 3.5
      this.trafficLanes.push({
        type: 'EW',
        z: rz - 3.5,
        dirX: 1,
        minX: this.minX,
        maxX: this.xRoads[this.xRoads.length - 1],
      });
      this.trafficLanes.push({
        type: 'EW',
        z: rz + 3.5,
        dirX: -1,
        minX: this.minX,
        maxX: this.xRoads[this.xRoads.length - 1],
      });
    }

    // Record intersections for turn logic
    for (const rx of this.xRoads) {
      for (const rz of this.zRoads) {
        this.intersections.push({ x: rx, z: rz });
      }
    }

    // 3. Elevated Sidewalks surrounding each block
    for (let xi = 0; xi < this.xRoads.length - 1; xi++) {
      for (let zi = 0; zi < this.zRoads.length - 1; zi++) {
        const x1 = this.xRoads[xi] + this.halfRoad;
        const x2 = this.xRoads[xi + 1] - this.halfRoad;
        const z1 = this.zRoads[zi] + this.halfRoad;
        const z2 = this.zRoads[zi + 1] - this.halfRoad;

        const blockW = x2 - x1;
        const blockD = z2 - z1;
        const midX = (x1 + x2) / 2;
        const midZ = (z1 + z2) / 2;

        const curbHeight = 0.22;
        const walkGeo = new THREE.BoxGeometry(blockW, curbHeight, blockD);
        const walkMesh = new THREE.Mesh(walkGeo, sidewalkMat);
        walkMesh.position.set(midX, curbHeight / 2, midZ);
        walkMesh.receiveShadow = true;
        this.group.add(walkMesh);

        // Sidewalk perimeter nodes for pedestrian AI navigation
        const margin = 1.6;
        this.sidewalkNodes.push({ x: x1 + margin, z: z1 + margin });
        this.sidewalkNodes.push({ x: x2 - margin, z: z1 + margin });
        this.sidewalkNodes.push({ x: x2 - margin, z: z2 - margin });
        this.sidewalkNodes.push({ x: x1 + margin, z: z2 - margin });
      }
    }

    // Eastern coastal promenade sidewalk along Coral Avenue
    const promX = this.xRoads[this.xRoads.length - 1] + this.halfRoad + 3.5;
    const promGeo = new THREE.BoxGeometry(7, 0.25, this.maxZ - this.minZ);
    const promMesh = new THREE.Mesh(promGeo, sidewalkMat);
    promMesh.position.set(promX, 0.125, 0);
    this.group.add(promMesh);
  }

  /** Creates distinct buildings per district with varied architectural styles. */
  createCityBlocks() {
    for (let xi = 0; xi < this.xRoads.length - 1; xi++) {
      for (let zi = 0; zi < this.zRoads.length - 1; zi++) {
        const x1 = this.xRoads[xi] + this.halfRoad + this.sidewalkWidth;
        const x2 = this.xRoads[xi + 1] - this.halfRoad - this.sidewalkWidth;
        const z1 = this.zRoads[zi] + this.halfRoad + this.sidewalkWidth;
        const z2 = this.zRoads[zi + 1] - this.halfRoad - this.sidewalkWidth;

        const blockCenterX = (x1 + x2) / 2;
        const blockCenterZ = (z1 + z2) / 2;
        const district = this.getDistrictAt(blockCenterX, blockCenterZ);

        this.generateBuildingsInBlock(x1, x2, z1, z2, district);
      }
    }
  }

  generateBuildingsInBlock(x1, x2, z1, z2, district) {
    const blockW = x2 - x1;
    const blockD = z2 - z1;

    // Subdivide block into 1, 2, or 4 building lots
    const roll = this.rng();

    if (roll < 0.35) {
      // 1 Grand Tower / Complex
      this.createBuilding(x1 + 2, x2 - 2, z1 + 2, z2 - 2, district, true);
    } else if (roll < 0.75) {
      // 2 Buildings side by side
      if (blockW >= blockD) {
        const mid = (x1 + x2) / 2;
        this.createBuilding(x1 + 1, mid - 1.5, z1 + 1, z2 - 1, district, false);
        this.createBuilding(mid + 1.5, x2 - 1, z1 + 1, z2 - 1, district, false);
      } else {
        const mid = (z1 + z2) / 2;
        this.createBuilding(x1 + 1, x2 - 1, z1 + 1, mid - 1.5, district, false);
        this.createBuilding(x1 + 1, x2 - 1, mid + 1.5, z2 - 1, district, false);
      }
    } else {
      // 4 Smaller buildings
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      this.createBuilding(x1 + 1, midX - 1.5, z1 + 1, midZ - 1.5, district, false);
      this.createBuilding(midX + 1.5, x2 - 1, z1 + 1, midZ - 1.5, district, false);
      this.createBuilding(x1 + 1, midX - 1.5, midZ + 1.5, z2 - 1, district, false);
      this.createBuilding(midX + 1.5, x2 - 1, midZ + 1.5, z2 - 1, district, false);
    }
  }

  createBuilding(minX, maxX, minZ, maxZ, district, isGrand) {
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    // Height based on district
    let height = 12 + this.rng() * 16;
    if (district.id === 'sunset_hills') {
      height = isGrand ? 48 + this.rng() * 32 : 24 + this.rng() * 28;
    } else if (district.id === 'coral_avenue') {
      height = isGrand ? 32 + this.rng() * 22 : 16 + this.rng() * 18;
    } else if (district.id === 'palm_heights') {
      height = isGrand ? 28 + this.rng() * 20 : 14 + this.rng() * 16;
    } else if (district.id === 'dockside') {
      height = 8 + this.rng() * 10;
    } else if (district.id === 'old_marina') {
      height = 10 + this.rng() * 14;
    }

    // Color palette based on district
    const buildingColor = this.getBuildingColor(district);
    const bldgMat = new THREE.MeshLambertMaterial({
      color: buildingColor,
      flatShading: true,
    });

    const bldgGeo = new THREE.BoxGeometry(width, height, depth);
    const bldgMesh = new THREE.Mesh(bldgGeo, bldgMat);
    bldgMesh.position.set(centerX, height / 2 + 0.2, centerZ);
    bldgMesh.castShadow = true;
    bldgMesh.receiveShadow = true;
    this.group.add(bldgMesh);

    // Architectural details: roof parapet / terrace
    const roofTrimMat = new THREE.MeshLambertMaterial({ color: 0x44464a });
    const roofTrimGeo = new THREE.BoxGeometry(width + 0.4, 0.8, depth + 0.4);
    const roofTrim = new THREE.Mesh(roofTrimGeo, roofTrimMat);
    roofTrim.position.set(centerX, height + 0.6, centerZ);
    this.group.add(roofTrim);

    // Rooftop AC unit / elevator housing
    if (this.rng() > 0.3) {
      const acW = Math.min(width * 0.4, 6);
      const acH = 2 + this.rng() * 2.5;
      const acD = Math.min(depth * 0.4, 6);
      const acGeo = new THREE.BoxGeometry(acW, acH, acD);
      const acMat = new THREE.MeshLambertMaterial({ color: 0x7a808a });
      const acMesh = new THREE.Mesh(acGeo, acMat);
      acMesh.position.set(
        centerX + (this.rng() - 0.5) * (width * 0.4),
        height + 0.6 + acH / 2,
        centerZ + (this.rng() - 0.5) * (depth * 0.4)
      );
      this.group.add(acMesh);
    }

    // Windows band or decorative balcony stripes
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x22364a });
    const floorCount = Math.floor(height / 4);
    for (let f = 1; f < floorCount; f++) {
      const y = f * 4;
      const stripeGeo = new THREE.BoxGeometry(width + 0.08, 1.4, depth + 0.08);
      const stripe = new THREE.Mesh(stripeGeo, windowMat);
      stripe.position.set(centerX, y, centerZ);
      this.group.add(stripe);
    }

    // Store collision box
    this.colliders.push({
      minX,
      maxX,
      minZ,
      maxZ,
      height,
      name: `building_${Math.round(centerX)}_${Math.round(centerZ)}`,
    });
  }

  getBuildingColor(district) {
    if (district.id === 'coral_avenue') {
      // Art Deco pastel colors
      const pastels = [0xf7c4b8, 0xa7d8de, 0xf6e5b5, 0xe4b7d5, 0xffe0c8, 0xffffff];
      return pastels[Math.floor(this.rng() * pastels.length)];
    }
    if (district.id === 'sunset_hills') {
      // Modern glass and sleek white/slate
      const modern = [0xe8edf2, 0xd4dee6, 0x9cb3c5, 0x6e889c, 0xf4f6f8];
      return modern[Math.floor(this.rng() * modern.length)];
    }
    if (district.id === 'palm_heights') {
      // Warm stucco and Mediterranean tones
      const warm = [0xf5e6cc, 0xe8ceaa, 0xdcb88f, 0xc8d6af, 0xf8f4ec];
      return warm[Math.floor(this.rng() * warm.length)];
    }
    if (district.id === 'old_marina') {
      // Brick, terracotta, weathered stone
      const brick = [0xa65244, 0x8c4639, 0xb87358, 0x6e5049, 0x4a4440];
      return brick[Math.floor(this.rng() * brick.length)];
    }
    // Dockside industrial corrugated metal and concrete
    const industrial = [0x54626f, 0x6c7c8a, 0x7b8b98, 0x8a9ba8, 0x3e4952];
    return industrial[Math.floor(this.rng() * industrial.length)];
  }

  /** Sandy beach with palm trees and a wooden pleasure pier. */
  createBeachAndPier() {
    // Palm trees lining the beach boulevard
    for (let z = this.minZ + 15; z <= this.maxZ - 15; z += 18) {
      this.createPalmTree(149, z);
      this.createPalmTree(175, z + (this.rng() - 0.5) * 8);
    }

    // Wooden Pier extending into the ocean at Z = 0
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x6e4e37 });
    const pierPlankGeo = new THREE.BoxGeometry(90, 0.6, 12);
    const pierPlanks = new THREE.Mesh(pierPlankGeo, pierMat);
    pierPlanks.position.set(220, 1.2, 0);
    this.group.add(pierPlanks);

    // Pier support pilings
    const pileGeo = new THREE.CylinderGeometry(0.5, 0.5, 3.5, 6);
    for (let px = 180; px <= 260; px += 16) {
      for (const pz of [-4.5, 4.5]) {
        const pile = new THREE.Mesh(pileGeo, pierMat);
        pile.position.set(px, 0.2, pz);
        this.group.add(pile);
      }
    }

    // Pier railing
    const railMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const railGeo = new THREE.BoxGeometry(90, 0.8, 0.2);
    const railN = new THREE.Mesh(railGeo, railMat);
    railN.position.set(220, 1.9, -5.8);
    const railS = new THREE.Mesh(railGeo, railMat);
    railS.position.set(220, 1.9, 5.8);
    this.group.add(railN);
    this.group.add(railS);
  }

  /** Creates realistic low-poly palm trees and streetlights across the city. */
  createStreetFurniture() {
    // Palms in Palm Heights and Sunset Hills
    for (const rx of this.xRoads) {
      for (const rz of this.zRoads) {
        // Streetlights at road intersections
        this.createStreetlight(rx + this.halfRoad + 1.8, rz + this.halfRoad + 1.8);
        this.createStreetlight(rx - this.halfRoad - 1.8, rz - this.halfRoad - 1.8);

        // Palms on sidewalks
        if (rx <= 70 && (rx !== 0 || rz !== 0)) {
          if (this.rng() > 0.4) {
            this.createPalmTree(rx + this.halfRoad + 2.2, rz + 18);
          }
          if (this.rng() > 0.4) {
            this.createPalmTree(rx - this.halfRoad - 2.2, rz - 18);
          }
        }
      }
    }
  }

  createPalmTree(x, z) {
    const palmGroup = new THREE.Group();
    palmGroup.position.set(x, 0, z);

    // Curved trunk made of stacked segmented cylinders
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x694f3d, flatShading: true });
    const segments = 5;
    let currY = 0;
    let currX = 0;
    const lean = (this.rng() - 0.5) * 0.8;

    for (let i = 0; i < segments; i++) {
      const segH = 1.4;
      const rBot = 0.35 - i * 0.04;
      const rTop = 0.31 - i * 0.04;
      const segGeo = new THREE.CylinderGeometry(rTop, rBot, segH, 6);
      const segMesh = new THREE.Mesh(segGeo, trunkMat);
      segMesh.position.set(currX, currY + segH / 2, 0);
      segMesh.rotation.z = lean * (i / segments);
      palmGroup.add(segMesh);

      currY += segH;
      currX += lean * 0.25;
    }

    // Lush frond canopy
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e753b, flatShading: true });
    const frondCount = 7;
    for (let f = 0; f < frondCount; f++) {
      const angle = (f / frondCount) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(0.8, 4.2, 4);
      const frondMesh = new THREE.Mesh(frondGeo, frondMat);
      frondMesh.position.set(currX, currY + 0.2, 0);
      frondMesh.rotation.x = Math.sin(angle) * 0.85;
      frondMesh.rotation.z = Math.cos(angle) * 0.85;
      frondMesh.rotation.y = angle;
      palmGroup.add(frondMesh);
    }

    this.group.add(palmGroup);
  }

  createStreetlight(x, z) {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3d45 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe6a3 });

    const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 6);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(x, 3, z);
    this.group.add(pole);

    const armGeo = new THREE.BoxGeometry(1.6, 0.12, 0.12);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(x + 0.7, 5.8, z);
    this.group.add(arm);

    const lampGeo = new THREE.BoxGeometry(0.5, 0.3, 0.4);
    const lamp = new THREE.Mesh(lampGeo, lightMat);
    lamp.position.set(x + 1.4, 5.6, z);
    this.group.add(lamp);
  }

  /** Identifies current district given 2D coordinates. */
  getDistrictAt(x, z) {
    if (x >= 80) {
      return DISTRICTS.CORAL_AVENUE;
    }
    if (z > 70) {
      return x < 0 ? DISTRICTS.OLD_MARINA : DISTRICTS.DOCKSIDE;
    }
    if (z < -50) {
      return x < 0 ? DISTRICTS.SUNSET_HILLS : DISTRICTS.PALM_HEIGHTS;
    }
    return DISTRICTS.PALM_HEIGHTS;
  }
}
