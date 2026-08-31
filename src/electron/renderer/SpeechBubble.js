// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Speech Bubble Component with Interactive Actions
// ─────────────────────────────────────────────────────────────────────────────

class SpeechBubble {
  /**
   * @param {HTMLElement} containerElement
   */
  constructor(containerElement) {
    this.container = containerElement;
    this.bubbleElement = document.createElement('div');
    this.bubbleElement.className = 'speech-bubble';
    this.container.appendChild(this.bubbleElement);

    this.hideTimeout = null;
  }

  /**
   * Displays a speech message.
   * @param {string|object} data - Message text or data payload
   * @param {number} [durationMs=3500] - Duration in ms before auto-hiding
   */
  say(data, durationMs = 3500) {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    const text = typeof data === 'string' ? data : (data?.text || '');
    const duration = typeof data === 'object' && data?.duration ? data.duration : durationMs;
    const buttonText = typeof data === 'object' ? data?.buttonText : null;
    const action = typeof data === 'object' ? data?.action : null;

    this.bubbleElement.innerHTML = '';

    const textSpan = document.createElement('span');
    textSpan.className = 'speech-text';
    textSpan.textContent = text;
    this.bubbleElement.appendChild(textSpan);

    if (buttonText) {
      const btn = document.createElement('button');
      btn.className = 'speech-action-btn';
      btn.textContent = buttonText;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (action === 'open-candidates' && window.grumpyDuckApi?.openCleanupWindow) {
          window.grumpyDuckApi.openCleanupWindow();
        }
        this.hide();
      });
      this.bubbleElement.appendChild(btn);
    }

    this.bubbleElement.classList.add('visible');

    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, duration);
  }

  /**
   * Hides the current speech bubble.
   */
  hide() {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
    this.bubbleElement.classList.remove('visible');
  }
}

window.SpeechBubble = SpeechBubble;
