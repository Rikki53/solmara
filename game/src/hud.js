// Solmara Heads-Up Display (HUD): minimap radar, speedometer, district banner, health bar, wanted stars, money, and objective panel.

export class Hud {
  constructor(container, city) {
    this.container = container;
    this.city = city;
    this.currentDistrict = null;
    this.districtDisplayTimer = 0;

    this.createElements();
    this.createMenus();
  }

  createMenus() {
    // 1. Title Screen Overlay
    this.titleOverlay = document.createElement('div');
    this.titleOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, #1e2530 0%, #0a0d12 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      z-index: 100;
      padding: 20px;
    `;
    this.titleOverlay.innerHTML = `
      <div style="font-size: 64px; font-weight: 900; letter-spacing: 6px; color: #ffbe53; text-shadow: 0 4px 24px rgba(255,190,83,0.4); margin-bottom: 8px;">SOLMARA</div>
      <div style="font-size: 18px; font-weight: 600; color: #94a3b8; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 32px;">Sun, Streets & Second Chances</div>
      
      <div style="background: rgba(18,22,28,0.85); border: 1px solid rgba(255,190,83,0.3); border-radius: 12px; padding: 22px 32px; max-width: 520px; width: 100%; margin-bottom: 28px; box-shadow: 0 8px 32px rgba(0,0,0,0.6);">
        <div style="font-size: 13px; font-weight: 700; color: #ffbe53; letter-spacing: 1.5px; margin-bottom: 10px; text-transform: uppercase;">Controls</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; color: #e2e8f0;">
          <div><b>WASD / Arrows</b>: Move / Drive</div>
          <div><b>Shift</b>: Sprint / Nitro</div>
          <div><b>Space</b>: Jump / Handbrake</div>
          <div><b>E</b>: Enter / Exit Car</div>
          <div><b>F</b>: Melee Punch</div>
          <div><b>M</b>: Toggle Mute</div>
          <div><b>P / Esc</b>: Pause Menu</div>
          <div><b>Mouse</b>: Orbit Camera</div>
        </div>
      </div>

      <button id="hud-start-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #111827; border: none; border-radius: 8px; padding: 16px 48px; font-size: 18px; font-weight: 800; cursor: pointer; letter-spacing: 1.5px; box-shadow: 0 4px 20px rgba(245,158,11,0.4);">START GAME</button>
      <div style="font-size: 12px; color: #64748b; margin-top: 14px;">Press ENTER or click START GAME</div>
    `;
    this.container.appendChild(this.titleOverlay);

    // 2. Pause Menu Overlay
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(10, 13, 18, 0.85);
      backdrop-filter: blur(6px);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      z-index: 90;
    `;
    this.pauseOverlay.innerHTML = `
      <div style="font-size: 42px; font-weight: 900; letter-spacing: 4px; color: #ffbe53; margin-bottom: 24px;">PAUSED</div>
      <div style="display: flex; flex-direction: column; gap: 12px; width: 260px;">
        <button id="hud-resume-btn" style="background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">Resume</button>
        <button id="hud-restart-btn" style="background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">Restart Game</button>
        <button id="hud-mute-btn" style="background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; padding: 12px; font-size: 15px; font-weight: 700; cursor: pointer;">Toggle Mute</button>
      </div>
    `;
    this.container.appendChild(this.pauseOverlay);

    // 3. Mission Complete Splash Overlay
    this.missionSplash = document.createElement('div');
    this.missionSplash.style.cssText = `
      position: absolute;
      top: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 22, 28, 0.95);
      border: 2px solid #4ade80;
      border-radius: 12px;
      padding: 20px 36px;
      text-align: center;
      display: none;
      pointer-events: auto;
      z-index: 80;
      box-shadow: 0 8px 32px rgba(74,222,128,0.3);
    `;
    this.missionSplash.innerHTML = `
      <div style="font-size: 12px; font-weight: 800; color: #4ade80; letter-spacing: 2px; margin-bottom: 4px;">MISSION COMPLETED</div>
      <div id="hud-splash-title" style="font-size: 22px; font-weight: 900; color: #fff; margin-bottom: 8px;">M1: First Wheels</div>
      <div id="hud-splash-reward" style="font-size: 16px; font-weight: 700; color: #ffbe53; margin-bottom: 16px;">Reward: +$500</div>
      <button id="hud-splash-continue" style="background: #4ade80; color: #111827; border: none; border-radius: 6px; padding: 10px 24px; font-size: 14px; font-weight: 800; cursor: pointer;">CONTINUE</button>
    `;
    this.container.appendChild(this.missionSplash);

    // 4. Game Over / Busted Overlay
    this.gameOverOverlay = document.createElement('div');
    this.gameOverOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(15, 5, 5, 0.9);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: auto;
      z-index: 95;
    `;
    this.gameOverOverlay.innerHTML = `
      <div id="hud-gameover-title" style="font-size: 56px; font-weight: 900; letter-spacing: 4px; color: #ef4444; margin-bottom: 12px; text-shadow: 0 0 20px rgba(239,68,68,0.5);">BUSTED</div>
      <div id="hud-gameover-subtitle" style="font-size: 16px; font-weight: 600; color: #94a3b8; margin-bottom: 32px; letter-spacing: 1px;">You were caught by the police or eliminated.</div>
      <button id="hud-gameover-restart" style="background: #ef4444; color: #fff; border: none; border-radius: 8px; padding: 14px 36px; font-size: 16px; font-weight: 800; cursor: pointer; letter-spacing: 1px;">RESTART GAME</button>
    `;
    this.container.appendChild(this.gameOverOverlay);
  }

  showTitle() {
    if (this.titleOverlay) this.titleOverlay.style.display = 'flex';
  }
  hideTitle() {
    if (this.titleOverlay) this.titleOverlay.style.display = 'none';
  }
  showPause() {
    if (this.pauseOverlay) this.pauseOverlay.style.display = 'flex';
  }
  hidePause() {
    if (this.pauseOverlay) this.pauseOverlay.style.display = 'none';
  }
  showMissionComplete(title, reward) {
    if (this.missionSplash) {
      document.getElementById('hud-splash-title').textContent = title;
      document.getElementById('hud-splash-reward').textContent = `Reward: +$${reward}`;
      this.missionSplash.style.display = 'block';
    }
  }
  hideMissionComplete() {
    if (this.missionSplash) this.missionSplash.style.display = 'none';
  }
  showGameOver(isBusted) {
    if (this.gameOverOverlay) {
      document.getElementById('hud-gameover-title').textContent = isBusted ? 'BUSTED' : 'WASTED';
      document.getElementById('hud-gameover-subtitle').textContent = isBusted ? 'Apprehended by Solmara Police Department.' : 'Critical injuries sustained in Solmara.';
      this.gameOverOverlay.style.display = 'flex';
    }
  }
  hideGameOver() {
    if (this.gameOverOverlay) this.gameOverOverlay.style.display = 'none';
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

    // Top Right: Clock, Wanted Stars & Money Box
    this.topRight = document.createElement('div');
    this.topRight.style.cssText = `
      position: absolute;
      top: 24px;
      right: 32px;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
    `;

    this.statsBox = document.createElement('div');
    this.statsBox.style.cssText = `
      background: rgba(18, 22, 28, 0.85);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 190, 83, 0.4);
      border-radius: 8px;
      padding: 10px 20px;
      display: flex;
      align-items: center;
      gap: 18px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    `;
    this.statsBox.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: flex-end;">
        <span style="font-size: 10px; font-weight: 800; color: #9aa4b2; letter-spacing: 1px;">CASH</span>
        <span id="hud-money" style="font-size: 22px; font-weight: 900; color: #4ade80;">$250</span>
      </div>
      <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.15);"></div>
      <div style="display: flex; flex-direction: column; align-items: flex-end;">
        <span style="font-size: 10px; font-weight: 800; color: #9aa4b2; letter-spacing: 1px;">WANTED</span>
        <div id="hud-wanted-stars" style="display: flex; gap: 3px; font-size: 16px; color: #64748b;">☆☆☆☆☆</div>
      </div>
    `;
    this.topRight.appendChild(this.statsBox);
    this.root.appendChild(this.topRight);

    // Mission Objective Panel (Top Center)
    this.objectiveBox = document.createElement('div');
    this.objectiveBox.style.cssText = `
      position: absolute;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 22, 28, 0.9);
      border: 1px solid rgba(255, 190, 83, 0.6);
      border-radius: 8px;
      padding: 10px 24px;
      max-width: 450px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    `;
    this.objectiveBox.innerHTML = `
      <div style="font-size: 10px; font-weight: 800; color: #ffbe53; letter-spacing: 1.5px; text-transform: uppercase;">CURRENT OBJECTIVE</div>
      <div id="hud-objective-text" style="font-size: 13px; font-weight: 600; color: #ffffff; margin-top: 2px;">Explore Solmara or start First Wheels mission.</div>
    `;
    this.root.appendChild(this.objectiveBox);

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
    this.controlsBar.textContent = 'WASD: Move/Drive | Shift: Sprint | Space: Jump | E: Car | F: Punch | M: Mute | P: Save';
    this.root.appendChild(this.controlsBar);

    this.container.appendChild(this.root);
  }

  update(player, trafficManager, pedestrians, nearbyVehicles, policeManager, missionManager, combatSystem) {
    // 1. Update District Name
    const district = this.city.getDistrictAt(player.x, player.z);
    if (!this.currentDistrict || this.currentDistrict.id !== district.id) {
      this.currentDistrict = district;
      this.districtName.textContent = district.name;
      this.districtName.style.color = district.color;
      this.districtSubtitle.textContent = district.subtitle;
    }

    // 2. Update Stats (Money & Wanted Stars & HP)
    if (missionManager) {
      document.getElementById('hud-money').textContent = `$${missionManager.money}`;
      document.getElementById('hud-objective-text').textContent = missionManager.objectiveText;
    }

    if (policeManager) {
      const w = policeManager.wantedLevel;
      let starsStr = '';
      for (let i = 0; i < 5; i++) {
        starsStr += i < w ? '★' : '☆';
      }
      const starEl = document.getElementById('hud-wanted-stars');
      starEl.textContent = starsStr;
      starEl.style.color = w > 0 ? '#f59e0b' : '#64748b';
    }

    if (combatSystem) {
      const hp = Math.round(combatSystem.health);
      document.getElementById('hud-hp-val').textContent = hp;
      document.getElementById('hud-hp-bar').style.width = `${hp}%`;
    }

    // 3. Update Speedometer
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

    // 4. Update Action Prompt
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

    // 5. Render Minimap Radar
    this.renderMinimap(player, trafficManager, pedestrians, policeManager, missionManager);
  }

  renderMinimap(player, trafficManager, pedestrians, policeManager, missionManager) {
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

    // Pay & Spray Garage Icon (wrench / blue dot at {x:35, z:56})
    const garageX = (35 - player.x) * mapScale;
    const garageZ = (56 - player.z) * mapScale;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(garageX, garageZ, 5, 0, Math.PI * 2);
    ctx.fill();

    // Mission Waypoint Marker
    if (missionManager && missionManager.waypointPos) {
      const wx = (missionManager.waypointPos.x - player.x) * mapScale;
      const wz = (missionManager.waypointPos.z - player.z) * mapScale;
      ctx.fillStyle = '#ffbe53';
      ctx.beginPath();
      ctx.arc(wx, wz, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Police Cars blips (red)
    if (policeManager && policeManager.policeCars) {
      ctx.fillStyle = '#ef4444';
      for (const pcar of policeManager.policeCars) {
        const pcx = (pcar.x - player.x) * mapScale;
        const pcz = (pcar.z - player.z) * mapScale;
        ctx.beginPath();
        ctx.arc(pcx, pcz, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Traffic Cars as grey rectangular blips
    if (trafficManager && trafficManager.vehicles) {
      for (let i = 0; i < trafficManager.vehicles.length; i++) {
        const car = trafficManager.vehicles[i];
        if (car.isOccupied || car.isPolice) continue;
        const cx = (car.x - player.x) * mapScale;
        const cz = (car.z - player.z) * mapScale;

        ctx.save();
        ctx.translate(cx, cz);
        ctx.rotate(-car.heading);
        ctx.fillStyle = car.config.type === 'taxi' ? '#f59e0b' : '#94a3b8';
        ctx.fillRect(-2, -4, 4, 8);
        ctx.restore();
      }
    }

    // Player indicator at center: bright green triangle
    ctx.save();
    const facingAngle = player.mode === 'driving' && player.vehicle ? player.vehicle.heading : player.heading;
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
