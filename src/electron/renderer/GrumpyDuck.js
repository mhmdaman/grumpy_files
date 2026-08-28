// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Main Renderer Controller
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const duckCanvas = document.getElementById('duck-canvas');
  const duckWrapper = document.getElementById('duck-wrapper');
  const bubbleContainer = document.getElementById('speech-bubble-container');

  const speech = new window.SpeechBubble(bubbleContainer);

  // Fallback configs in case IPC hasn't returned yet
  const fallbackConfigs = {
    IDLE: { relativePath: 'assets/grumpyduck/idle.png', frameCount: 8, fps: 6, loop: true },
    WALK_LEFT: { relativePath: 'assets/grumpyduck/walk-left.png', frameCount: 8, fps: 8, loop: true },
    WALK_RIGHT: { relativePath: 'assets/grumpyduck/walk-right.png', frameCount: 8, fps: 8, loop: true },
    SCANNING: { relativePath: 'assets/grumpyduck/scan.png', frameCount: 8, fps: 6, loop: true },
  };

  let configs = fallbackConfigs;
  if (window.grumpyDuckApi?.getSpriteConfigs) {
    try {
      configs = await window.grumpyDuckApi.getSpriteConfigs();
    } catch {
      configs = fallbackConfigs;
    }
  }

  // Initialize Sprite Animator
  const animator = new window.SpriteAnimator(duckCanvas, configs, 'IDLE');
  duckWrapper.classList.add('is-idle');
  animator.setState('IDLE');

  const updateStateClasses = (state) => {
    duckWrapper.classList.remove('is-idle', 'is-walking');
    if (state === 'WALK_LEFT' || state === 'WALK_RIGHT') {
      duckWrapper.classList.add('is-walking');
    } else {
      duckWrapper.classList.add('is-idle');
    }
  };

  // Listen for state changes from Main process
  if (window.grumpyDuckApi?.onStateChanged) {
    window.grumpyDuckApi.onStateChanged((state) => {
      animator.setState(state);
      updateStateClasses(state);
    });
  }

  // Listen for speech events from Main process
  if (window.grumpyDuckApi?.onShowSpeech) {
    window.grumpyDuckApi.onShowSpeech((data) => {
      speech.say(data.text, data.duration || 3500);
    });
  }

  // Listen for bounce reaction
  if (window.grumpyDuckApi?.onBounce) {
    window.grumpyDuckApi.onBounce(() => {
      duckWrapper.classList.remove('bouncing');
      // Trigger reflow
      void duckWrapper.offsetWidth;
      duckWrapper.classList.add('bouncing');
      setTimeout(() => duckWrapper.classList.remove('bouncing'), 600);
    });
  }

  // ── Mouse Interaction & Dragging ──────────────────────────────────────────
  let isPointerDown = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;

  duckWrapper.addEventListener('mousedown', (e) => {
    // Right click handled by contextmenu
    if (e.button === 2) return;

    isPointerDown = true;
    hasMoved = false;
    startX = e.screenX;
    startY = e.screenY;

    if (window.grumpyDuckApi?.notifyDragStart) {
      window.grumpyDuckApi.notifyDragStart();
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPointerDown) return;

    const deltaX = e.screenX - startX;
    const deltaY = e.screenY - startY;

    if (Math.hypot(deltaX, deltaY) > 3) {
      if (!hasMoved) {
        hasMoved = true;
        duckWrapper.classList.add('is-dragging');
        duckWrapper.classList.remove('is-landing');
      }

      startX = e.screenX;
      startY = e.screenY;

      // Request window position adjustment
      if (window.grumpyDuckApi?.notifyDragEnd) {
        window.grumpyDuckApi.notifyDragEnd({
          x: window.screenX + deltaX,
          y: window.screenY + deltaY,
        });
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (hasMoved) {
      duckWrapper.classList.remove('is-dragging');
      duckWrapper.classList.add('is-landing');
      setTimeout(() => duckWrapper.classList.remove('is-landing'), 500);

      if (window.grumpyDuckApi?.notifyDragEnd) {
        window.grumpyDuckApi.notifyDragEnd();
      }
    } else {
      // User clicked without dragging — trigger click reaction
      duckWrapper.classList.remove('clicked');
      void duckWrapper.offsetWidth;
      duckWrapper.classList.add('clicked');
      setTimeout(() => duckWrapper.classList.remove('clicked'), 400);

      if (window.grumpyDuckApi?.notifyClick) {
        window.grumpyDuckApi.notifyClick();
      }
    }
  });

  // Right-click context menu
  duckWrapper.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (window.grumpyDuckApi?.showContextMenu) {
      window.grumpyDuckApi.showContextMenu();
    }
  });

  // Initial grumpy entrance greeting
  setTimeout(() => {
    speech.say('🐥 *quack* Ready.', 3000);
  }, 600);
});
