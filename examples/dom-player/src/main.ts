import { setup } from "@stategraph/core";
import { bindEvent, mountActor, onSnapshot } from "@stategraph/dom";

type PlayerEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TOGGLE_MUTE" };

const playerMachine = setup<object, PlayerEvent>({}).createMachine({
  id: "player",
  type: "parallel",
  context: {},
  states: {
    playback: {
      initial: "paused",
      states: {
        paused: { on: { PLAY: { target: "playing" } } },
        playing: { on: { PAUSE: { target: "paused" } } },
      },
    },
    volume: {
      initial: "unmuted",
      states: {
        unmuted: { on: { TOGGLE_MUTE: { target: "muted" } } },
        muted: { on: { TOGGLE_MUTE: { target: "unmuted" } } },
      },
    },
  },
});

// Build minimal UI
const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("#app not found");

app.innerHTML = `
  <div style="font-family:sans-serif;padding:2rem;max-width:400px">
    <h1>DOM Player</h1>
    <div style="display:flex;gap:1rem;margin-bottom:1rem">
      <button id="playBtn">Play</button>
      <button id="muteBtn">Mute</button>
    </div>
    <p id="status">Loading…</p>
  </div>
`;

const playBtn = document.getElementById("playBtn") as HTMLButtonElement;
const muteBtn = document.getElementById("muteBtn") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;

const { actor } = mountActor(playerMachine);

bindEvent(playBtn, "click", actor, (e: Event): PlayerEvent => {
  const label = (e.currentTarget as HTMLButtonElement).textContent ?? "";
  return label === "Pause" ? { type: "PAUSE" } : { type: "PLAY" };
});

bindEvent(muteBtn, "click", actor, { type: "TOGGLE_MUTE" });

onSnapshot(actor, (snap) => {
  const cfg = snap.configuration;
  const isPlaying = cfg.has("player.playback.playing");
  const isMuted = cfg.has("player.volume.muted");

  playBtn.textContent = isPlaying ? "Pause" : "Play";
  muteBtn.textContent = isMuted ? "Unmute" : "Mute";
  statusEl.textContent = `Playback: ${isPlaying ? "playing" : "paused"} | Volume: ${isMuted ? "muted" : "unmuted"}`;
});
