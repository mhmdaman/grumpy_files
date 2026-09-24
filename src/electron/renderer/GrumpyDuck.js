// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Main Renderer Controller (GIF Architecture)
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const duckImg = document.getElementById('duck-img');
  const duckWrapper = document.getElementById('duck-wrapper');
  const bubbleContainer = document.getElementById('speech-bubble-container');
  const debugOverlay = document.getElementById('debug-overlay');
  const debugState = document.getElementById('debug-state');
  const debugGif = document.getElementById('debug-gif');
  const debugPrev = document.getElementById('debug-prev');
  const debugPrio = document.getElementById('debug-prio');
  const debugPlatform = document.getElementById('debug-platform');

  const speech = new window.SpeechBubble(bubbleContainer);

  // Fallback configs including newly discovered animations
  const fallbackConfigs = {
    IDLE: { name: 'idle', relativePath: 'assets/grumpyduck/idle.gif', loop: true, type: 'gif' },
    WALK_LEFT: { name: 'walk-left', relativePath: 'assets/grumpyduck/walk-left.gif', loop: true, type: 'gif' },
    WALK_RIGHT: { name: 'walk-right', relativePath: 'assets/grumpyduck/walk-right.gif', loop: true, type: 'gif' },
    SCANNING: { name: 'scan', relativePath: 'assets/grumpyduck/scan.gif', loop: true, type: 'gif' },
    HAPPY: { name: 'happy', relativePath: 'assets/grumpyduck/happy.gif', loop: true, type: 'gif' },
    SURPRISED: { name: 'surprised', relativePath: 'assets/grumpyduck/surprised.gif', loop: true, type: 'gif' },
    THINKING: { name: 'thinking', relativePath: 'assets/grumpyduck/thinking.gif', loop: true, type: 'gif' },
  };

  let configs = fallbackConfigs;
  if (window.grumpyDuckApi?.getSpriteConfigs) {
    try {
      configs = await window.grumpyDuckApi.getSpriteConfigs();
    } catch {
      configs = fallbackConfigs;
    }
  }

  // Initialize GIF Animator
  const animator = new window.GifAnimator(duckImg, configs, 'IDLE');
  animator.setState('IDLE');

  const updateDebugInfo = (debug) => {
    if (!debug) return;
    if (debug.isDebug) {
      debugOverlay.classList.remove('hidden');
      if (debugState) debugState.textContent = `State: ${debug.state || 'IDLE'}`;
      if (debugGif) debugGif.textContent = `GIF: ${debug.currentGif || (configs[debug.state]?.name || 'idle')}.gif`;
      if (debugPrev) debugPrev.textContent = `Prev: ${debug.previousState || '-'}`;
      if (debugPrio !== null && debugPrio !== undefined && debug.priority !== undefined) {
        debugPrio.textContent = `Priority: ${debug.priority}`;
      }
      if (debugPlatform && debug.platform) debugPlatform.textContent = `Plat: ${debug.platform.name}`;
    } else {
      debugOverlay.classList.add('hidden');
    }
  };

  // Initial debug state check
  if (window.grumpyDuckApi?.getDebugState) {
    try {
      const debug = await window.grumpyDuckApi.getDebugState();
      updateDebugInfo(debug);
    } catch {}
  }

  // State change listener
  if (window.grumpyDuckApi?.onStateChanged) {
    window.grumpyDuckApi.onStateChanged(async (state) => {
      animator.setState(state);
      if (window.grumpyDuckApi?.getDebugState) {
        try {
          const debug = await window.grumpyDuckApi.getDebugState();
          updateDebugInfo(debug);
        } catch {}
      }
    });
  }

  // Platform change listener
  if (window.grumpyDuckApi?.onPlatformChanged) {
    window.grumpyDuckApi.onPlatformChanged((platform) => {
      if (debugPlatform && platform) {
        debugPlatform.textContent = `Plat: ${platform.name}`;
      }
    });
  }

  // Debug overlay toggle listener
  if (window.grumpyDuckApi?.onDebugChanged) {
    window.grumpyDuckApi.onDebugChanged((debug) => {
      updateDebugInfo(debug);
    });
  }

  // Speech listener
  if (window.grumpyDuckApi?.onShowSpeech) {
    window.grumpyDuckApi.onShowSpeech((data) => {
      speech.say(data, data?.duration || 3500);
    });
  }

  // Bounce listener
  if (window.grumpyDuckApi?.onBounce) {
    window.grumpyDuckApi.onBounce(() => {
      duckWrapper.classList.remove('bouncing');
      void duckWrapper.offsetWidth;
      duckWrapper.classList.add('bouncing');
      setTimeout(() => duckWrapper.classList.remove('bouncing'), 600);
    });
  }

  // ── Mouse Dragging & Interaction ──────────────────────────────────────────
  let isPointerDown = false;
  let hasMoved = false;
  let startScreenX = 0;
  let startScreenY = 0;
  let startWinX = 0;
  let startWinY = 0;

  duckWrapper.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return; // Right click

    isPointerDown = true;
    hasMoved = false;
    startScreenX = e.screenX;
    startScreenY = e.screenY;
    startWinX = window.screenX;
    startWinY = window.screenY;

    try {
      duckWrapper.setPointerCapture(e.pointerId);
    } catch {}

    if (window.grumpyDuckApi?.notifyDragStart) {
      window.grumpyDuckApi.notifyDragStart();
    }
  });

  duckWrapper.addEventListener('pointermove', (e) => {
    if (!isPointerDown) return;

    const deltaX = e.screenX - startScreenX;
    const deltaY = e.screenY - startScreenY;

    if (Math.hypot(deltaX, deltaY) > 3) {
      if (!hasMoved) {
        hasMoved = true;
        duckWrapper.classList.add('is-dragging');
        duckWrapper.classList.remove('is-landing');
      }

      const targetWinX = startWinX + deltaX;
      const targetWinY = startWinY + deltaY;

      if (window.grumpyDuckApi?.notifyDragMove) {
        window.grumpyDuckApi.notifyDragMove({
          x: targetWinX,
          y: targetWinY,
        });
      }
    }
  });

  const handlePointerEnd = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    try {
      duckWrapper.releasePointerCapture(e.pointerId);
    } catch {}

    if (hasMoved) {
      duckWrapper.classList.remove('is-dragging');
      duckWrapper.classList.add('is-landing');
      setTimeout(() => duckWrapper.classList.remove('is-landing'), 450);

      const deltaX = e.screenX - startScreenX;
      const deltaY = e.screenY - startScreenY;

      if (window.grumpyDuckApi?.notifyDragEnd) {
        window.grumpyDuckApi.notifyDragEnd({
          x: startWinX + deltaX,
          y: startWinY + deltaY,
        });
      }
    } else {
      duckWrapper.classList.remove('clicked');
      void duckWrapper.offsetWidth;
      duckWrapper.classList.add('clicked');
      setTimeout(() => duckWrapper.classList.remove('clicked'), 400);

      if (window.grumpyDuckApi?.notifyClick) {
        window.grumpyDuckApi.notifyClick();
      }
    }
  };

  duckWrapper.addEventListener('pointerup', handlePointerEnd);
  duckWrapper.addEventListener('pointercancel', handlePointerEnd);

  // Right-click context menu
  duckWrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.grumpyDuckApi?.showContextMenu) {
      window.grumpyDuckApi.showContextMenu();
    }
  });

  // Initial greeting
  setTimeout(() => {
    speech.say('🐥 *quack* Ready.', 3000);
  }, 500);
});
