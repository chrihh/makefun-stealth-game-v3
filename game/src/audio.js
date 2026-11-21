// Verdant Vault — tiny WebAudio synth: no audio files, every sound is
// an oscillator or a filtered noise burst made on the spot.

let ctx = null;
let muted = false;

export function toggleMute() { muted = !muted; return muted; }

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.08, slide = 0) {
  if (muted) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur);
}

function crunch(dur = 0.09, gain = 0.05) {
  if (muted) return;
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  stepGravel() { crunch(0.08, 0.035); },
  stepSoft() { crunch(0.05, 0.012); },
  pod() { tone(880, 0.16, 'triangle', 0.1, -420); setTimeout(() => tone(1320, 0.1, 'sine', 0.06), 40); },
  pickup() { tone(660, 0.09, 'sine', 0.07); setTimeout(() => tone(990, 0.12, 'sine', 0.07), 70); },
  laser() { tone(220, 0.22, 'sawtooth', 0.07, 320); },
  alarm() { tone(520, 0.14, 'square', 0.05); setTimeout(() => tone(520, 0.14, 'square', 0.05), 180); },
  caught() { tone(300, 0.4, 'sawtooth', 0.09, -190); },
  vent() { tone(180, 0.2, 'sine', 0.06, 260); },
  clear() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.07), i * 85)); },
};
