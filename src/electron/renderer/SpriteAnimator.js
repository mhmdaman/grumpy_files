// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Reusable Sprite Animation Engine
// ─────────────────────────────────────────────────────────────────────────────

class SpriteAnimator {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object.<string, { relativePath: string, frameCount: number, fps: number, loop?: boolean }>} configs
   * @param {string} defaultState
   */
  constructor(canvas, configs, defaultState = 'IDLE') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.configs = configs;
    this.defaultState = defaultState;
    this.currentState = defaultState;

    this.loadedImages = new Map();
    this.currentFrame = 0;
    this.animInterval = null;
    this.isOneShot = false;
    this.onOneShotComplete = null;

    // Retina / High DPI support
    this.dpr = window.devicePixelRatio || 1;
    this.canvasWidth = canvas.clientWidth || parseInt(canvas.getAttribute('width'), 10) || 75;
    this.canvasHeight = canvas.clientHeight || parseInt(canvas.getAttribute('height'), 10) || 72;

    this.canvas.width = this.canvasWidth * this.dpr;
    this.canvas.height = this.canvasHeight * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);

    // Preload all sprite images
    this.preloadSprites();
  }

  /**
   * Preloads all sprite sheets defined in configs.
   */
  preloadSprites() {
    for (const [key, cfg] of Object.entries(this.configs)) {
      const img = new Image();
      // Relative path from pet.html location
      img.src = `../../../${cfg.relativePath}`;
      img.onload = () => {
        if (this.currentState === key && this.currentFrame === 0) {
          this.renderFrame();
        }
      };
      this.loadedImages.set(key, img);
    }
  }

  /**
   * Switches to a new animation state.
   * @param {string} state - The state key (e.g. 'IDLE', 'WALK_LEFT', 'WALK_RIGHT', 'SCANNING')
   * @param {Object} [options]
   * @param {boolean} [options.loop] - Override looping
   * @param {number} [options.fps] - Override FPS
   * @param {Function} [options.onComplete] - Callback when one-shot finishes
   */
  setState(state, options = {}) {
    const config = this.configs[state];
    if (!config) {
      console.warn(`[SpriteAnimator] Unknown animation state: ${state}`);
      return;
    }

    // Stop current animation loop
    this.stop();

    this.currentState = state;
    this.currentFrame = 0;
    this.isOneShot = options.loop !== undefined ? !options.loop : config.loop === false;
    this.onOneShotComplete = options.onComplete || null;

    const fps = options.fps || config.fps || 6;
    const intervalMs = Math.round(1000 / fps);

    // Initial render
    this.renderFrame();

    // Start frame loop
    this.animInterval = setInterval(() => {
      this.advanceFrame();
    }, intervalMs);
  }

  /**
   * Advances the animation by one frame.
   */
  advanceFrame() {
    const config = this.configs[this.currentState];
    if (!config) return;

    const frameCount = config.frameCount || 8;
    this.currentFrame++;

    if (this.currentFrame >= frameCount) {
      if (this.isOneShot) {
        this.stop();
        if (typeof this.onOneShotComplete === 'function') {
          const cb = this.onOneShotComplete;
          this.onOneShotComplete = null;
          cb();
        } else {
          // Return to default state
          this.setState(this.defaultState);
        }
        return;
      } else {
        // Loop back to start
        this.currentFrame = 0;
      }
    }

    this.renderFrame();
  }

  /**
   * Renders the current frame onto the canvas.
   */
  renderFrame() {
    const config = this.configs[this.currentState];
    const img = this.loadedImages.get(this.currentState);

    if (!img || !img.complete || img.naturalWidth === 0) {
      return;
    }

    const frameCount = config.frameCount || 8;
    const srcFrameWidth = img.naturalWidth / frameCount;
    const srcFrameHeight = img.naturalHeight;
    const srcX = this.currentFrame * srcFrameWidth;
    const srcY = 0;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Scale character to fit canvas neatly while maintaining aspect ratio
    const destHeight = this.canvasHeight;
    const scaleRatio = destHeight / srcFrameHeight;
    const destWidth = srcFrameWidth * scaleRatio;
    const destX = (this.canvasWidth - destWidth) / 2;
    const destY = 0;

    this.ctx.drawImage(
      img,
      srcX,
      srcY,
      srcFrameWidth,
      srcFrameHeight,
      destX,
      destY,
      destWidth,
      destHeight
    );
  }

  /**
   * Stops the current animation interval.
   */
  stop() {
    if (this.animInterval) {
      clearInterval(this.animInterval);
      this.animInterval = null;
    }
  }

  /**
   * Gets current state key.
   */
  getCurrentState() {
    return this.currentState;
  }
}

window.SpriteAnimator = SpriteAnimator;
