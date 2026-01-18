"use client";

// Centralized audio utility for consistent sound effects throughout the app

// Get or create a shared AudioContext
let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return sharedAudioContext;
  } catch {
    return null;
  }
}

/**
 * Play a subtle cancel sound - soft descending tone
 */
export function playCancelSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Soft descending tone for cancel
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available
  }
}

/**
 * Play a quiet click sound - for enter/tab/button presses
 */
export function playClickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Very short, subtle click
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(600, ctx.currentTime + 0.02);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch {
    // Audio not available
  }
}

/**
 * Play a satisfying multitone chime - for positive selections
 */
export function playSelectionChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 - major chord arpeggio
    const startTime = ctx.currentTime;

    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(freq, startTime + i * 0.08);
      oscillator.type = "sine";

      const noteStart = startTime + i * 0.08;
      gainNode.gain.setValueAtTime(0, noteStart);
      gainNode.gain.linearRampToValueAtTime(0.15, noteStart + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.25);

      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.3);

      // Add a subtle harmonic for warmth
      const harmonic = ctx.createOscillator();
      const harmonicGain = ctx.createGain();

      harmonic.connect(harmonicGain);
      harmonicGain.connect(ctx.destination);

      harmonic.frequency.setValueAtTime(freq * 2, noteStart);
      harmonic.type = "sine";

      harmonicGain.gain.setValueAtTime(0, noteStart);
      harmonicGain.gain.linearRampToValueAtTime(0.05, noteStart + 0.02);
      harmonicGain.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.15);

      harmonic.start(noteStart);
      harmonic.stop(noteStart + 0.2);
    });
  } catch {
    // Audio not available
  }
}

/**
 * Play triumphant sound and say "To the Moon!" - for successful login
 */
export function playLoginSuccess(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startTime = ctx.currentTime;

    // Triumphant fanfare notes - C major arpeggio going up
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, startTime);
      osc.type = "triangle";

      const noteStart = startTime + i * 0.06;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.3);

      osc.start(noteStart);
      osc.stop(noteStart + 0.35);
    });

    // Use Web Speech API to say "To the Moon!"
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance("To the Moon!");
      utterance.rate = 1.1;
      utterance.pitch = 1.2;
      utterance.volume = 0.8;
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 300);
    }
  } catch {
    // Audio not available
  }
}

/**
 * Play a success sound - for completed actions
 */
export function playSuccessSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Two-note success chime
    const notes = [523.25, 783.99]; // C5, G5
    const startTime = ctx.currentTime;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      const noteStart = startTime + i * 0.1;
      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.1, noteStart + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, noteStart + 0.2);

      osc.start(noteStart);
      osc.stop(noteStart + 0.25);
    });
  } catch {
    // Audio not available
  }
}

/**
 * Play an error sound - for failed actions
 */
export function playErrorSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Low buzz for error
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    gain.gain.setValueAtTime(0.06, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio not available
  }
}

/**
 * Play a subtle long-press feedback sound - mimics haptic click
 */
export function playLongPressSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Low frequency pulse (~200Hz) for tactile feel
    osc.type = "sine";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.1);

    // Very short duration (~100ms) with quick attack/decay
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch {
    // Audio not available
  }
}
