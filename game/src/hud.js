// Solmara Heads-Up Display (HUD): minimap radar, speedometer, district banner, health bar, and control prompts.

export class Hud {
  constructor(container, city) {
    this.container = container;
    this.city = city;
    this.currentDistrict = null;
    this.districtDisplayTimer = 0;

    this.createElements();
  }

  createElements() {
    this.root = document.createElement('div');
    this.root.id = 'hud-root';
    this.root.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      user-select: none;
      color: #ffffff;
      overflow: hidden;
    `;

    // 1. Top Bar: District Announcement & Clock
    this.topBar = document.createElement('div');
    this.topBar.style.cssText = `
      position: absolute;
      top: 24px;
      left: 32px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      text-shadow: 0 2px 8px rgba(0,0,0,0.8);
    `;

    this.districtName = document.createElement('div');
    this.districtName.style.cssText = `
      font-size: 28px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: #ffbe53;
      transition: opacity 0.4s ease;
    `;
    this.districtName.textContent = 'CORAL AVENUE';

    this.districtSubtitle = document.createElement('div');
    this.districtSubtitle.style.cssText = `
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #e0e0e0;
      text-transform: uppercase;
    `;
    this.districtSubtitle.textContent = 'Sun-Drenched Beach Boulevard';

    this.topBar.appendChild(this.districtName);
    this.topBar.appendChild(this.districtSubtitle);
    this.root.appendChild(this.topBar);

    // In-game Clock (Top Right)
    this.clockBox = document.createElement('div');
    this.clockBox.style.cssText = `
      position: absolute;
      top: 24px;
      right: 32px;
      background: rgba(18, 22, 28, 0.75);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 190, 83, 0.4);
      border-radius: 8px;
      padding: 8px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;
    this.clockBox.innerHTML = `
      <span style="color: #ffbe53; font-size: 16px;">☀</span>
      <span id="hud-clock" style="font-size: 20px; font-weight: 700; letter-spacing: 1px;">17:48</span>
      <span style="font-size: 12px; font-weight: 600; color: #ffaa44; background: rgba(255,170,68,0.2); padding: 2px 6px; border-radius: 4px;">GOLDEN HOUR</span>
    `;
    this.root.appendChild(this.clockBox);

    // 2. Bottom-Left Container: Health bar + Minimap Radar
    this.bottomLeft = document.createElement('div');
    this.bottomLeft.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 28px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    `;

    // Health Bar
    this.healthContainer = document.createElement('div');
    this.healthContainer.style.cssText = `
      width: 220px;
      background: rgba(18, 22, 28, 0.85);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 5px 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
    `;
    this.healthContainer.innerHTML = `
      <span style="font-size: 12px; font-weight: 800; color: #4ade80;">HP</span>
      <div style="flex: 1; height: 10px; background: #2a2e38; border-radius: 4px; overflow: hidden;">
        <div id="hud-hp-bar" style="width: 100%; height: 100%; background: linear-gradient(90deg, #22c55e, #4ade80); border-radius: 4px; transition: width 0.2s;"></div>
      </div>
      <span id="hud-hp-val" style="font-size: 12px; font-weight: 700; color: #ffffff;">100</span>
    `;
    this.bottomLeft.appendChild(this.healthContainer);

    // Minimap Canvas
    this.minimapCanvas = document.createElement('canvas');
    this.minimapSize = 220;
    this.minimapCanvas.width = this.minimapSize * 2;
    this.minimapCanvas.height = this.minimapSize * 2;
    this.minimapCanvas.style.cssText = `
      width: ${this.minimapSize}px;
      height: ${this.minimapSize}px;
      border-radius: 50%;
      border: 3px solid #ffbe53;
      box-shadow: 0 6px 20px rgba(0,0,0,0.8), inset 0 0 16px rgba(0,0,0,0.6);
      background: #191c22;
      display: block;
    `;
    this.minimapCtx = this.minimapCanvas.getContext('2d');
    this.bottomLeft.appendChild(this.minimapCanvas);

    this.root.appendChild(this.bottomLeft);

    // 3. Bottom-Right Container: Speedometer (active while driving)
    this.speedoContainer = document.createElement('div');
    this.speedoContainer.style.cssText = `
      position: absolute;
      bottom: 24px;
      right: 32px;
      background: rgba(18, 22, 28, 0.85);
      border: 1px solid rgba(255, 190, 83, 0.4);
      border-radius: 12px;
      padding: 14px 24px;
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.6);
    `;
    this.speedoContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 2px; color: #ffbe53;">SOLMARA MOTORS</span>
        <span id="hud-gear-label" style="font-size: 11px; font-weight: 800; color: #4ade80; background: rgba(74,222,128,0.15); padding: 1px 6px; border-radius: 3px;">DRIVE</span>
      </div>
      <div style="display: flex; align-items: baseline; gap: 6px;">
        <span id="hud-speed-num" style="font-size: 48px; font-weight: 900; line-height: 1; color: #ffffff;">0</span>
        <span style="font-size: 16px; font-weight: 700; color: #ffaa44;">MPH</span>
      </div>
      <div style="width: 140px; height: 6px; background: #2c3240; border-radius: 3px; overflow: hidden; margin-top: 4px;">
        <div id="hud-speed-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #ffbe53, #ff5722); transition: width 0.05s;"></div>
      </div>
      <div id="hud-vehicle-name" style="font-size: 12px; font-weight: 600; color: #9aa4b2; margin-top: 2px;">Veloce GT</div>
    `;
    this.root.appendChild(this.speedoContainer);

    // 4. Center Action Prompt Overlay (e.g. "[E] Enter Vehicle")
    this.promptBox = document.createElement('div');
    this.promptBox.style.cssText = `
      position: absolute;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 22, 28, 0.88);
      border: 1px solid #ffbe53;
      border-radius: 8px;
      padding: 10px 22px;
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      display: none;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
      letter-spacing: 0.5px;
    `;
    this.root.appendChild(this.promptBox);

    // 5. Controls Help Bar (Bottom Center)
    this.controlsBar = document.createElement('div');
    this.controlsBar.style.cssText = `
      position: absolute;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.5px;
      color: rgba(255, 255, 255, 0.7);
      text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      white-space: nowrap;
    `;
    this.controlsBar.textContent = 'WASD: Move / Drive  |  Shift: Sprint  |  Space: Jump / Handbrake  |  E: Enter / Exit Car  |  Mouse: Orbit Camera';
    this.root.appendChild(this.controlsBar);

    this.container.appendChild(this.root);
  }

  update(player, trafficManager, pedestrians, nearbyVehicles) {
    // 1. Update District Name
    const district = this.city.getDistrictAt(player.x, player.z);
    if (!this.currentDistrict || this.currentDistrict.id !== district.id) {
      this.currentDistrict = district;
      this.districtName.textContent = district.name;
      this.districtName.style.color = district.color;
      this.districtSubtitle.textContent = district.subtitle;
    }

    // 2. Update Speedometer
    if (player.mode === 'driving' && player.vehicle) {
      this.speedoContainer.style.display = 'flex';
      const speedMph = Math.round(Math.abs(player.vehicle.speed) * 2.237);
      document.getElementById('hud-speed-num').textContent = speedMph;
      const speedPercent = Math.min(100, (Math.abs(player.vehicle.speed) / player.vehicle.config.maxSpeed) * 100);
      document.getElementById('hud-speed-bar').style.width = `${speedPercent}%`;
      document.getElementById('hud-vehicle-name').textContent = player.vehicle.config.name;
    } else {
      this.speedoContainer.style.display = 'none';
    }

    // 3. Update Action Prompt
    if (player.mode === 'foot') {
      const enterable = player.findNearestEnterableVehicle(nearbyVehicles);
      if (enterable) {
        this.promptBox.style.display = 'block';
        this.promptBox.innerHTML = `<span style="color: #ffbe53; font-weight: 800;">[E]</span> Drive ${enterable.config.name}`;
      } else {
        this.promptBox.style.display = 'none';
      }
    } else if (player.mode === 'driving') {
      this.promptBox.style.display = 'none';
    }

    // 4. Render Minimap Radar
    this.renderMinimap(player, trafficManager, pedestrians);
  }

  renderMinimap(player, trafficManager, pedestrians) {
    const ctx = this.minimapCtx;
    const size = this.minimapSize * 2;
    const center = size / 2;
    const radius = center - 8;
    const mapScale = 1.6; // Pixels per world unit

    ctx.save();
    ctx.clearRect(0, 0, size, size);

    // Circular clip path for round radar
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Map background: dark asphalt/terrain
    ctx.fillStyle = '#1c2028';
    ctx.fillRect(0, 0, size, size);

    // Transform so player is at center of radar
    ctx.translate(center, center);

    // Ocean on eastern edge (world X >= 220)
    const oceanScreenX = (220 - player.x) * mapScale;
    ctx.fillStyle = '#1b5f85';
    ctx.fillRect(oceanScreenX, -size, size * 2, size * 2);

    // Sandy Beach strip (world X from 155 to 220)
    const beachScreenX = (155 - player.x) * mapScale;
    const beachWidth = (220 - 155) * mapScale;
    ctx.fillStyle = '#bda46c';
    ctx.fillRect(beachScreenX, -size, beachWidth, size * 2);

    // City Building Footprints
    ctx.fillStyle = '#2b303c';
    for (let i = 0; i < this.city.colliders.length; i++) {
      const b = this.city.colliders[i];
      const bx = (b.minX - player.x) * mapScale;
      const bz = (b.minZ - player.z) * mapScale;
      const bw = (b.maxX - b.minX) * mapScale;
      const bd = (b.maxZ - b.minZ) * mapScale;
      ctx.fillRect(bx, bz, bw, bd);
    }

    // City Roads (North-South Avenues)
    ctx.fillStyle = '#3f4654';
    for (const rx of this.city.xRoads) {
      const sx = (rx - player.x) * mapScale - (this.city.roadWidth / 2) * mapScale;
      const sz = (this.city.minZ - player.z) * mapScale;
      const sw = this.city.roadWidth * mapScale;
      const sh = (this.city.maxZ - this.city.minZ) * mapScale;
      ctx.fillRect(sx, sz, sw, sh);
    }

    // City Roads (East-West Streets)
    for (const rz of this.city.zRoads) {
      const sx = (this.city.minX - player.x) * mapScale;
      const sz = (rz - player.z) * mapScale - (this.city.roadWidth / 2) * mapScale;
      const sw = (this.city.maxX - this.city.minX) * mapScale;
      const sh = this.city.roadWidth * mapScale;
      ctx.fillRect(sx, sz, sw, sh);
    }

    // Pedestrians as subtle dots
    if (pedestrians) {
      ctx.fillStyle = '#94a3b8';
      for (let i = 0; i < pedestrians.length; i++) {
        const p = pedestrians[i];
        const px = (p.x - player.x) * mapScale;
        const pz = (p.z - player.z) * mapScale;
        ctx.beginPath();
        ctx.arc(px, pz, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Traffic Cars as orange/white rectangular blips
    if (trafficManager && trafficManager.vehicles) {
      for (let i = 0; i < trafficManager.vehicles.length; i++) {
        const car = trafficManager.vehicles[i];
        if (car.isOccupied) continue;
        const cx = (car.x - player.x) * mapScale;
        const cz = (car.z - player.z) * mapScale;

        ctx.save();
        ctx.translate(cx, cz);
        ctx.rotate(-car.heading);
        ctx.fillStyle = car.config.type === 'taxi' ? '#f59e0b' : '#cbd5e1';
        ctx.fillRect(-3, -5, 6, 10);
        ctx.restore();
      }
    }

    // Player indicator at center: bright green / white triangle
    ctx.save();
    const facingAngle = player.mode === 'driving' && player.vehicle ? player.vehicle.heading : player.heading;
    // Map coordinate system: +X is right, +Z is down
    ctx.rotate(-facingAngle);

    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.lineTo(6, -6);
    ctx.lineTo(0, -3);
    ctx.lineTo(-6, -6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore(); // Restore unclipped / unscaled

    // North Compass Indicator at top of radar
    ctx.save();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', center, 14);
    ctx.restore();
  }
}
