(() => {
  'use strict';

  const MUTE_KEY = 'portfolio-ui-sound-muted';
  const interactiveSelector = 'a[href], button, [role="button"], summary, input[type="button"], input[type="submit"], input[type="reset"]';
  const textEntrySelector = 'input:not([type]), input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="url"], input[type="password"], input[type="number"], textarea, [contenteditable="true"]';
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  let audioContext = null;
  let activeOscillator = null;
  let muted = false;

  try {
    muted = sessionStorage.getItem(MUTE_KEY) === 'true';
  } catch (error) {
    console.warn('The sound preference could not be restored for this session.', error);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'site-sound-toggle';
  toggle.setAttribute('aria-label', muted ? 'Unmute interface sounds' : 'Mute interface sounds');
  toggle.setAttribute('aria-pressed', String(muted));
  toggle.title = muted ? 'Unmute sounds' : 'Mute sounds';

  function updateToggle() {
    toggle.setAttribute('aria-label', muted ? 'Unmute interface sounds' : 'Mute interface sounds');
    toggle.setAttribute('aria-pressed', String(muted));
    toggle.title = muted ? 'Unmute sounds' : 'Mute sounds';
    toggle.innerHTML = muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13"/></svg>';
  }

  updateToggle();
  document.body.append(toggle);

  toggle.addEventListener('click', () => {
    muted = !muted;
    updateToggle();
    try {
      sessionStorage.setItem(MUTE_KEY, String(muted));
    } catch (error) {
      console.warn('The sound preference could not be saved for this session.', error);
    }
  });

  function playClickSound() {
    if (muted || !AudioContextConstructor) return;

    try {
      audioContext ||= new AudioContextConstructor();
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch((error) => {
          console.warn('The interface audio context could not resume.', error);
        });
      }

      const now = audioContext.currentTime;
      if (activeOscillator) {
        try {
          activeOscillator.stop(now + 0.002);
        } catch (error) {
          if (error.name !== 'InvalidStateError') throw error;
        }
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1120, now);
      oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.045);
      gain.gain.setValueAtTime(0.018, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.07);
      activeOscillator = oscillator;
      oscillator.addEventListener('ended', () => {
        if (activeOscillator === oscillator) activeOscillator = null;
        oscillator.disconnect();
        gain.disconnect();
      }, { once: true });
    } catch (error) {
      console.warn('The interface click sound could not be played.', error);
    }
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest(interactiveSelector);
    if (!control || control === toggle || control.matches(textEntrySelector)) return;
    playClickSound();
  }, true);
})();
