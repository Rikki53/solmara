// Solmara save/load system via localStorage (money, mission progress, stats, settings).

export class SaveSystem {
  constructor() {
    this.key = 'solmara_save_data_v1';
  }

  saveGame(data) {
    try {
      const payload = {
        money: data.money || 0,
        currentMissionIndex: data.currentMissionIndex || 0,
        missionsCompleted: data.missionsCompleted || [],
        playerX: data.playerX || 148,
        playerZ: data.playerZ || 15,
        muted: data.muted || false,
        timestamp: Date.now(),
      };
      localStorage.setItem(this.key, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.warn('Failed to save game to localStorage:', e);
      return false;
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load game from localStorage:', e);
      return null;
    }
  }

  clearSave() {
    try {
      localStorage.removeItem(this.key);
    } catch (_) {}
  }
}
