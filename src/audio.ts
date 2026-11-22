import type { Settings } from "./model";
type Timbre =
  "wood" | "ceramic" | "cork" | "kalimba" | "marimba" | "paper" | "grain";
type Sound = { tone: Timbre; notes: number[]; gap: number; duration: number };
const palette = {
  add: { tone: "ceramic", notes: [430, 645], gap: 0.045, duration: 0.15 },
  remove: { tone: "cork", notes: [245], gap: 0, duration: 0.14 },
  quantity: { tone: "wood", notes: [380], gap: 0, duration: 0.11 },
  fill: {
    tone: "grain",
    notes: [1200, 1400, 1050],
    gap: 0.045,
    duration: 0.13,
  },
  goal: {
    tone: "kalimba",
    notes: [392, 494, 587, 784],
    gap: 0.16,
    duration: 0.31,
  },
  book: { tone: "paper", notes: [1550, 1100], gap: 0.08, duration: 0.19 },
  tab: { tone: "paper", notes: [1600], gap: 0, duration: 0.12 },
  calendar: { tone: "paper", notes: [1850, 1300], gap: 0.07, duration: 0.14 },
  undo: { tone: "marimba", notes: [392, 294], gap: 0.08, duration: 0.18 },
  redo: { tone: "marimba", notes: [294, 392], gap: 0.08, duration: 0.18 },
} satisfies Record<string, Sound>;
export type Cue = keyof typeof palette;
let ctx: AudioContext | undefined,
  active = 0;
const last = new Map<Cue, number>();
export function play(cue: Cue, s: Settings) {
  if (
    !s.sound ||
    s.volume <= 0 ||
    (cue === "goal" && !s.celebrate) ||
    active >= 4
  )
    return;
  const now = performance.now();
  if (now - (last.get(cue) ?? -Infinity) < (cue === "goal" ? 650 : 90)) return;
  try {
    if (!ctx && navigator.userActivation && !navigator.userActivation.isActive)
      return;
    ctx ??= new AudioContext();
    const c = ctx;
    if (c.state === "suspended")
      void c.resume().catch((e) => console.debug("Sound paused", e));
    const { tone, notes, gap, duration } = palette[cue],
      t = c.currentTime + 0.004;
    last.set(cue, now);
    active++;
    notes.forEach((freq, i) => {
      const start = t + i * gap,
        amp = c.createGain(),
        filter = c.createBiquadFilter();
      let source: AudioBufferSourceNode | OscillatorNode;
      if (tone === "paper" || tone === "grain") {
        const buffer = c.createBuffer(
            1,
            Math.ceil(c.sampleRate * duration),
            c.sampleRate,
          ),
          samples = buffer.getChannelData(0);
        for (let n = 0; n < samples.length; n++)
          samples[n] =
            (2 * Math.random() - 1) *
            (tone === "grain" ? (n % 907 < 190 ? 1 : 0.15) : 1);
        const noise = c.createBufferSource();
        noise.buffer = buffer;
        source = noise;
        filter.type = "bandpass";
        filter.frequency.value = freq;
        filter.Q.value = 0.8;
      } else {
        const osc = c.createOscillator();
        osc.type = tone === "wood" || tone === "kalimba" ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(
          freq * (tone === "cork" ? 0.48 : 0.995),
          start + duration,
        );
        source = osc;
        filter.type = "lowpass";
        filter.frequency.value = tone === "wood" ? 1000 : 3000;
      }
      amp.gain.setValueAtTime(0.00001, start);
      amp.gain.exponentialRampToValueAtTime(
        Math.max(0.00002, s.volume * 0.16),
        start + 0.009,
      );
      amp.gain.exponentialRampToValueAtTime(0.00001, start + duration);
      source.connect(filter).connect(amp).connect(c.destination);
      source.start(start);
      source.stop(start + duration + 0.01);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        amp.disconnect();
        if (i === notes.length - 1) active = Math.max(0, active - 1);
      };
    });
  } catch (e) {
    console.debug("Kitchen sound unavailable", e);
  }
}
