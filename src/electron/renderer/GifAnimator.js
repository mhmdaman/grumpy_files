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
    this.configs = configs || {};
    this.defaultState = defaultState;
    this.currentState = defaultState;

    this.preloadedSrcs = new Map();
    this.preloadAnimations();

    // Safety fallback if any asset fails to load
    this.imgElement.addEventListener('error', () => {
      console.warn(`[GifAnimator] Image load error on src: ${this.imgElement.src}. Falling back to idle.`);
      const idleSrc = this.preloadedSrcs.get(this.defaultState) || `../../../${this.configs[this.defaultState]?.relativePath || 'assets/grumpyduck/idle.gif'}`;
      if (this.imgElement.src !== idleSrc) {
        this.imgElement.src = idleSrc;
      }
    });
  }

  /**
   * Preloads all GIF assets into browser cache for instant transitions.
   */
  preloadAnimations() {
    for (const [key, cfg] of Object.entries(this.configs)) {
      if (cfg && cfg.relativePath) {
        const src = `../../../${cfg.relativePath}`;
        const img = new Image();
        img.src = src;
        this.preloadedSrcs.set(key, src);
      }
    }
  }

  /**
   * Switches to a new animation state.
   * Falls back gracefully to idle if animation is unavailable.
   * @param {string} state - State key ('IDLE', 'HAPPY', 'THINKING', etc.)
   */
  setState(state) {
    const normalizedKey = (state || this.defaultState).toUpperCase();

    if (!this.configs[normalizedKey]) {
      console.warn(`Animation unavailable: ${state}, falling back to idle.`);
      this.setState(this.defaultState);
      return;
    }

    if (this.currentState === normalizedKey && this.imgElement.getAttribute('src')) {
      return;
    }

    this.currentState = normalizedKey;
    const targetSrc = this.preloadedSrcs.get(normalizedKey) || `../../../${this.configs[normalizedKey].relativePath}`;

    // Smooth switch
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

