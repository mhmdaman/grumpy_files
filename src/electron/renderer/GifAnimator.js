// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — GIF Animation Controller for Desktop Pet
// ─────────────────────────────────────────────────────────────────────────────

class GifAnimator {
  /**
   * @param {HTMLImageElement} imgElement
   * @param {Object.<string, { relativePath: string, loop?: boolean }>} configs
   * @param {string} defaultState
   */
  constructor(imgElement, configs, defaultState = 'IDLE') {
    this.imgElement = imgElement;
    this.configs = configs;
    this.defaultState = defaultState;
    this.currentState = defaultState;

    this.preloadedSrcs = new Map();
    this.preloadAnimations();
  }

  /**
   * Preloads all GIF assets into browser cache for instant transitions.
   */
  preloadAnimations() {
    for (const [key, cfg] of Object.entries(this.configs)) {
      // Relative path from pet.html location
      const src = `../../../${cfg.relativePath}`;
      const img = new Image();
      img.src = src;
      this.preloadedSrcs.set(key, src);
    }
  }

  /**
   * Switches to a new animation state.
   * @param {string} state - State key ('IDLE', 'WALK_LEFT', 'WALK_RIGHT', 'SCANNING')
   */
  setState(state) {
    if (!this.configs[state]) {
      console.warn(`[GifAnimator] Unknown animation state: ${state}`);
      return;
    }

    if (this.currentState === state && this.imgElement.getAttribute('src')) {
      return;
    }

    this.currentState = state;
    const targetSrc = this.preloadedSrcs.get(state) || `../../../${this.configs[state].relativePath}`;
    
    // Smooth transition
    this.imgElement.src = targetSrc;
  }

  /**
   * Gets current state key.
   */
  getCurrentState() {
    return this.currentState;
  }
}

window.GifAnimator = GifAnimator;
