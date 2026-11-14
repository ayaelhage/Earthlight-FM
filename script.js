// ===== NIGHT LIGHTS IMAGE =====
const img = new Image();
img.src = "assets/images/lights-change.jpg";

img.onload = () => {
  // 1. Read NASA's pixels (invisible canvas)
  const reader = document.createElement("canvas");
  reader.width = img.width;
  reader.height = img.height;
  const readerCtx = reader.getContext("2d");
  readerCtx.drawImage(img, 0, 0);
  const pixels = readerCtx.getImageData(0, 0, img.width, img.height).data;

  // 2. Visible canvas
  const canvas = document.getElementById("dots");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;

  const step = 6;        // size of each grid cell
  const threshold = 25;  // minimum brightness to count as a light

  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {

      // 3. Find the BRIGHTEST pixel inside this cell
      let best = 0, r = 0, g = 0, b = 0;
      for (let dy = 0; dy < step && y + dy < img.height; dy++) {
        for (let dx = 0; dx < step && x + dx < img.width; dx++) {
          const i = ((y + dy) * img.width + (x + dx)) * 4;
          const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          if (brightness > best) {
            best = brightness;
            r = pixels[i]; g = pixels[i + 1]; b = pixels[i + 2];
          }
        }
      }

      if (best > threshold) {
        // 4. Make the color vivid (keep its hue, push it to full brightness)
        const boost = 255 / Math.max(r, g, b, 1);
        const color = `rgb(${r * boost}, ${g * boost}, ${b * boost})`;

        // 5. Brighter light = bigger dot, with a cheap soft glow
        const size = 0.8 + (best / 255) * (step * 0.45);
        const alpha = 0.35 + (best / 255) * 0.65;
        ctx.fillStyle = color;

        // glow: a bigger, very transparent circle behind the dot
        ctx.globalAlpha = alpha * 0.25;
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, size * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // the dot itself
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 6. Runs ONCE, after all the dots are drawn
  log("NASA SVS 5276 · night lights loaded");
  log(`image ${img.width} x ${img.height} px`);
  regionBox = { x: 0, y: 0, w: img.width, h: img.height, imgWidth: img.width };
  strips = analyzeRegion(pixels, img.width, regionBox);
  log(`analyzed ${STRIPS} strips · ready`);
};

img.onerror = () => console.log("Image NOT found. Check the name and folder!");


// ===== ON AIR / STANDBY INDICATOR =====
const onAir = document.getElementById("on-air");
const onAirText = document.getElementById("on-air-text");

function setOnAir(isLive) {
  onAir.classList.toggle("is-live", isLive);
  onAirText.textContent = isLive ? "On air" : "Standby";
}


// ===== SYSTEM LOG (code screen) =====
const logEl = document.getElementById("log");

function log(message) {
  const lines = (logEl.textContent + "\n> " + message).split("\n");
  logEl.textContent = lines.slice(-9).join("\n");
}


// ===== SOUND ENGINE =====
const STRIPS = 32;   // how many slices the region is cut into (= notes per song)

// notes always from a pentatonic scale, so it never sounds wrong
const KALIMBA_NOTES = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5"];
const STYLO_NOTES   = ["C2", "D2", "E2", "G2", "A2", "C3", "D3", "E3"];

let strips = [];      // the measured data, one item per strip
let playStep = 0;     // which strip is playing now
let loopOn = false;
let currentRegion = "the whole world";
let regionBox = null; // the rectangle of the image being played

// turns a color into its position on the color wheel (0-360)
function getHue(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return h;
}

// cuts a region into vertical strips and measures gained vs lost light
function analyzeRegion(pixels, imgWidth, box) {
  const result = [];
  const stripWidth = box.w / STRIPS;

  for (let s = 0; s < STRIPS; s++) {
    let gained = 0, lost = 0, count = 0;
    const startX = Math.floor(box.x + s * stripWidth);
    const endX = Math.floor(box.x + (s + 1) * stripWidth);

    for (let y = box.y; y < box.y + box.h; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const i = (y * imgWidth + x) * 4;
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        const brightness = (r + g + b) / 3;
        count++;

        if (brightness < 25) continue;                 // dark: no light here
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if ((max - min) / max < 0.2) continue;         // greyish: no clear change

        const hue = getHue(r, g, b);
        if (hue >= 250 && hue <= 320) gained += brightness;   // purple
        else if (hue >= 10 && hue <= 50) lost += brightness;  // orange
      }
    }
    result.push({ gained: gained / count, lost: lost / count });
  }

  // scale everything to 0-1, using ONE shared maximum so gains and losses stay comparable
  const max = Math.max(...result.map(s => Math.max(s.gained, s.lost)), 0.0001);
  return result.map(s => ({ gained: s.gained / max, lost: s.lost / max }));
}


// ===== INSTRUMENTS =====
const reverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).toDestination();

// kalimba: a bell-like plucked sound
const kalimba = new Tone.PolySynth(Tone.FMSynth, {
  harmonicity: 8,
  modulationIndex: 2,
  oscillator: { type: "sine" },
  envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1.2 },
  modulation: { type: "square" },
  modulationEnvelope: { attack: 0.002, decay: 0.2, sustain: 0, release: 0.2 }
}).connect(reverb);
kalimba.volume.value = -6;

// stylophone: buzzy square wave, softened by a filter
const styloFilter = new Tone.Filter(1200, "lowpass").connect(reverb);
const stylophone = new Tone.Synth({
  oscillator: { type: "square" },
  envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.2 }
}).connect(styloFilter);
stylophone.volume.value = -18;

function pickNote(notes, value) {
  const index = Math.min(notes.length - 1, Math.floor(value * notes.length));
  return notes[index];
}


// ===== PLAYBACK =====
Tone.Transport.bpm.value = 100;

let stopping = false;

Tone.Transport.scheduleRepeat((time) => {
  if (strips.length === 0 || stopping) return;

  // reached the end of the region
  if (playStep >= STRIPS) {
    if (loopOn) {
      playStep = 0;
    } else {
      stopping = true;
      Tone.Draw.schedule(stopPlayback, time);
      return;
    }
  }

  const s = strips[playStep];
  const played = [];

  if (s.gained > 0.05) {
    const note = pickNote(KALIMBA_NOTES, s.gained);
    kalimba.triggerAttackRelease(note, "8n", time, 0.3 + s.gained * 0.7);
    played.push(`+light ${note}`);
  }

  if (s.lost > 0.05) {
    const note = pickNote(STYLO_NOTES, s.lost);
    stylophone.triggerAttackRelease(note, "16n", time, 0.3 + s.lost * 0.7);
    played.push(`-light ${note}`);
  }

  // longitude of this strip (the map goes from 180°W to 180°E)
  const centerX = regionBox.x + (playStep + 0.5) * (regionBox.w / STRIPS);
  const lon = Math.round(-180 + (centerX / regionBox.imgWidth) * 360);
  const lonText = lon < 0 ? `${-lon}°W` : `${lon}°E`;

  const current = playStep + 1;
  Tone.Draw.schedule(() => {
    log(`strip ${current}/${STRIPS} · ${lonText} · ${played.join(" ") || "silence"}`);
  }, time);

  playStep++;
}, "8n");

function stopPlayback() {
  Tone.Transport.stop();
  playStep = 0;
  stopping = false;
  setOnAir(false);
  playBtn.classList.remove("is-on");
  nowPlaying.textContent = `Finished playing ${currentRegion}.`;
  log("end of track");
}


// ===== BUTTONS =====
const playBtn = document.getElementById("play-btn");
const pauseBtn = document.getElementById("pause-btn");
const repeatBtn = document.getElementById("repeat-btn");
const muteBtn = document.getElementById("mute-btn");
const nowPlaying = document.getElementById("now-playing");

playBtn.addEventListener("click", async () => {
  await Tone.start();
  if (strips.length === 0) {
    log("still loading NASA image...");
    return;
  }
  Tone.Transport.start();
  setOnAir(true);
  playBtn.classList.add("is-on");
  nowPlaying.textContent = `Playing ${currentRegion}. Kalimba means more light, stylophone means less light.`;
  log(`play · ${currentRegion}`);
});

pauseBtn.addEventListener("click", () => {
  Tone.Transport.pause();
  setOnAir(false);
  playBtn.classList.remove("is-on");
  nowPlaying.textContent = "Paused.";
  log("pause");
});

repeatBtn.addEventListener("click", () => {
  loopOn = !loopOn;
  repeatBtn.setAttribute("aria-pressed", loopOn);
  log(`loop ${loopOn ? "on" : "off"}`);
});

muteBtn.addEventListener("click", () => {
  Tone.Destination.mute = !Tone.Destination.mute;
  muteBtn.setAttribute("aria-pressed", Tone.Destination.mute);
  log(Tone.Destination.mute ? "muted" : "sound on");
});