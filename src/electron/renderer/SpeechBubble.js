// ─────────────────────────────────────────────────────────────────────────────
// GrumpyDuck — Speech Bubble Component
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
   * @param {string} text - Message text
   * @param {number} [durationMs=3500] - Duration in ms before auto-hiding
   */
  say(text, durationMs = 3500) {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this.bubbleElement.textContent = text;
    this.bubbleElement.classList.add('visible');

    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, durationMs);
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
