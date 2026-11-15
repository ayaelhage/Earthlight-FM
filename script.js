// ===== HERO: high-detail night lights (visual only) =====
const heroImg = new Image();
heroImg.src = "assets/images/lights-change.jpg";

heroImg.onload = () => setTimeout(() => {
  // 1. Read the pixels (invisible canvas)
  const reader = document.createElement("canvas");
  reader.width = heroImg.width;
  reader.height = heroImg.height;
  const readerCtx = reader.getContext("2d");
  readerCtx.drawImage(heroImg, 0, 0);
  const pixels = readerCtx.getImageData(0, 0, heroImg.width, heroImg.height).data;

  // 2. Visible canvas
  const canvas = document.getElementById("dots");
  const ctx = canvas.getContext("2d");
  canvas.width = heroImg.width;
  canvas.height = heroImg.height;

  const step = 4;        // size of each grid cell (bigger image → finer dots)
  const threshold = 25;  // minimum brightness to count as a light

  for (let y = 0; y < heroImg.height; y += step) {
    for (let x = 0; x < heroImg.width; x += step) {

      // 3. Find the BRIGHTEST pixel inside this cell
      let best = 0, r = 0, g = 0, b = 0;
      for (let dy = 0; dy < step && y + dy < heroImg.height; dy++) {
        for (let dx = 0; dx < step && x + dx < heroImg.width; dx++) {
          const i = ((y + dy) * heroImg.width + (x + dx)) * 4;
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

        ctx.globalAlpha = alpha * 0.25;
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, size * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
document.getElementById("dots").classList.add("is-ready");
}, 50);

heroImg.onerror = () => console.log("HD hero image NOT found. Check the name and folder!");


// ===== DATA: NASA image used by the sound engine =====
const dataImg = new Image();
dataImg.src = "assets/images/lights-change.jpg";

dataImg.onload = () => {
  const reader = document.createElement("canvas");
  reader.width = dataImg.width;
  reader.height = dataImg.height;
  const readerCtx = reader.getContext("2d");
  readerCtx.drawImage(dataImg, 0, 0);

  nasaPixels = readerCtx.getImageData(0, 0, dataImg.width, dataImg.height).data;
  changePixels = nasaPixels;
  imgW = dataImg.width;
  imgH = dataImg.height;
  log("NASA SVS 5276 · night lights loaded");
  log(`image ${imgW} x ${imgH} px`);
  selectRegion("world");
};

dataImg.onerror = () => console.log("Data image NOT found. Check the name and folder!");


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
const STYLO_NOTES = ["C2", "D2", "E2", "G2", "A2", "C3", "D3", "E3"];

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

// cuts a region into vertical strips and measures light
// mode "change": purple = gained, orange = lost (change map)
// mode "brightness": any light = gained (yearly maps)
function analyzeRegion(pixels, imgWidth, box, mode = "change", raw = false) {
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

        if (mode === "brightness") {                   // yearly map: any light counts
          gained += brightness;
          continue;
        }

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if ((max - min) / max < 0.2) continue;         // greyish: no clear change

        const hue = getHue(r, g, b);
        if (hue >= 250 && hue <= 320) gained += brightness;   // purple
        else if (hue >= 10 && hue <= 50) lost += brightness;  // orange
      }
    }
    result.push({ gained: gained / (count || 1), lost: lost / (count || 1) });
  }

  if (raw) return result;   // unscaled numbers (used to compare years)

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
kalimba.volume.value = 0;

// stylophone: buzzy square wave, softened by a filter
const styloFilter = new Tone.Filter(1200, "lowpass").connect(reverb);
const stylophone = new Tone.Synth({
  oscillator: { type: "square" },
  envelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.2 }
}).connect(styloFilter);
stylophone.volume.value = -10;

// master: evens out loud/quiet notes, then boosts safely
Tone.Destination.chain(
  new Tone.Compressor(-24, 4),
  new Tone.Limiter(-1)
);
Tone.Destination.volume.value = 4;

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
  const played = [];   // text for the log
  const events = [];   // data for the notes screen

  if (s.gained > 0.05) {
    const note = pickNote(KALIMBA_NOTES, s.gained);
    kalimba.triggerAttackRelease(note, "8n", time, 0.5 + s.gained * 0.5);
    played.push(`+light ${note}`);
    events.push({ note, kind: "gain", strength: s.gained });
  }

  if (s.lost > 0.05) {
    const note = pickNote(STYLO_NOTES, s.lost);
    stylophone.triggerAttackRelease(note, "16n", time, 0.5 + s.lost * 0.5);
    played.push(`-light ${note}`);
    events.push({ note, kind: "loss", strength: s.lost });
  }

  // longitude of this strip (the map goes from 180°W to 180°E)
  const centerX = regionBox.x + (playStep + 0.5) * (regionBox.w / STRIPS);
  const lon = Math.round(-180 + (centerX / regionBox.imgWidth) * 360);
  const lonText = lon < 0 ? `${-lon}°W` : `${lon}°E`;

  const current = playStep + 1;
  Tone.Draw.schedule(() => {
    log(`strip ${current}/${STRIPS} · ${lonText} · ${played.join(" ") || "silence"}`);
    pointGlobeAt(lon);
    drawGraph(current - 1);
    spawnNotes(events);
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
  if (currentKey === "world") setGlobeTracking(false);
  drawGraph(-1);
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
  setGlobeTracking(true);
  setOnAir(true);
  playBtn.classList.add("is-on");
  nowPlaying.textContent = {
    change: `Playing ${currentRegion}, what changed from 2012 to 2023. Kalimba means more light, stylophone means less light.`,
    brightness: `Playing ${currentRegion} in ${currentYear}. Higher, louder notes mean brighter lights.`,
    compare: `Playing ${currentRegion}, comparing ${yearLabel()}. Kalimba means brighter, stylophone means dimmer.`
  }[currentMode];
  log(`play · ${currentRegion} · ${yearLabel()}`);
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

const muteIcon = muteBtn.querySelector(".icon");

muteBtn.addEventListener("click", () => {
  const muted = !Tone.Destination.mute;
  Tone.Destination.mute = muted;
  muteBtn.setAttribute("aria-pressed", muted);

  // swap the icon: speaker ↔ speaker with a slash
  muteIcon.classList.toggle("icon-volume", !muted);
  muteIcon.classList.toggle("icon-mute", muted);

  log(muted ? "muted" : "sound on");
});



// ===== REGIONS (latitude / longitude boxes) =====
let nasaPixels = null;
let imgW = 0;
let imgH = 0;

const REGIONS = {
  "world": { name: "the whole world", west: -180, east: 180, north: 90, south: -90 },
  "north-america": { name: "North America", west: -170, east: -50, north: 84, south: 7 },
  "south-america": { name: "South America", west: -92, east: -32, north: 13, south: -56 },
  "europe": { name: "Europe", west: -25, east: 45, north: 72, south: 34 },
  "africa": { name: "Africa", west: -20, east: 55, north: 38, south: -36 },
  "asia": { name: "Asia", west: 45, east: 180, north: 78, south: -11 },
  "oceania": { name: "Oceania", west: 110, east: 180, north: 0, south: -48 }
};

// turns a latitude/longitude box into a pixel rectangle on NASA's flat map
function regionToBox(r) {
  const mapH = imgW / 2;              // a flat world map is twice as wide as it is tall
  const top = (imgH - mapH) / 2;      // empty band above and below the map
  const x1 = ((r.west + 180) / 360) * imgW;
  const x2 = ((r.east + 180) / 360) * imgW;
  const y1 = Math.max(0, top + ((90 - r.north) / 180) * mapH);
  const y2 = Math.min(imgH, top + ((90 - r.south) / 180) * mapH);
  return {
    x: Math.round(x1),
    y: Math.round(y1),
    w: Math.round(x2 - x1),
    h: Math.round(y2 - y1),
    imgWidth: imgW
  };
}

// skips empty ocean at the left and right edges of a region
function trimBox(box) {
  const T = 0.05;
  // years are all trimmed using 2023, so every year uses the SAME box
  const refPixels = currentMode === "change" ? changePixels : yearCache[2023];
  const refMode = currentMode === "change" ? "change" : "brightness";
  const test = analyzeRegion(refPixels, imgW, box, refMode);
  const first = test.findIndex(s => s.gained > T || s.lost > T);
  if (first === -1) return box;

  let last = test.length - 1;
  while (last > first && test[last].gained <= T && test[last].lost <= T) last--;

  const stripW = box.w / STRIPS;
  return {
    ...box,
    x: Math.round(box.x + first * stripW),
    w: Math.round((last - first + 1) * stripW)
  };
}

function selectRegion(key) {
  if (!nasaPixels) {
    log("NASA image still loading...");
    return;
  }
  const r = REGIONS[key];
  currentRegion = r.name;
  regionBox = trimBox(regionToBox(r));
  strips = computeStrips(regionBox);
  playStep = 0;

  // light up the chosen continent (and the World key)
  document.querySelectorAll(".continent").forEach(g => {
    const on = g.id === key;
    g.classList.toggle("is-selected", on);
    g.setAttribute("aria-pressed", on);
  });
  document.getElementById("world-btn").setAttribute("aria-pressed", key === "world");
  document.getElementById("map-screen").classList.toggle("world-selected", key === "world");

  nowPlaying.textContent = `${r.name} selected. Press play to listen.`;
  log(`region: ${r.name} · ${STRIPS} strips ready`);

  currentKey = key;
  if (key === "world") {
    setGlobeTracking(false);
  } else {
    setGlobeTracking(true);
    pointGlobeAt((r.west + r.east) / 2);
  }
  drawGraph(-1);
}

document.getElementById("world-btn").addEventListener("click", () => selectRegion("world"));


// ===== WORLD MAP (simplemaps SVG grouped into continents) =====

// countries in ONE piece use their id (ISO code)
const CODES = {
  "north-america": "AI AW BB BZ BM VG CR CU CW DM DO SV GL GD GT HT HN JM MQ MX MS NI PA LC VC BL MF SX BQSA BQSE BQBO",
  "south-america": "BO BR CO EC GF GY PY PE SR UY VE",
  "europe": "AL AT BY BE BA BG HR CZ EE FI DE HU IS IE XK LV LT LU MK MD ME NL PL PT RO RS SK SI ES SE CH UA",
  "africa": "DZ BJ BW BF BI CM CF TD CI CD DJ EG GQ ER ET GA GH GN GW KE LS LR LY MG MW ML MR YT MA MZ NA NE NG CG RE RW SN SL SO ZA SS SD SZ TZ GM TG TN UG EH ZM ZW",
  "asia": "AF AM BH BD BT BN KH KP GE IN IR IQ IL JO KZ KW KG LA LB MV MN MM NP PK PS QA KR SA LK SY TW TJ TH TL TM AE UZ VN YE",
  "oceania": "GU MH NR PW TV"
};

// countries in SEVERAL pieces use their name (class)
const NAMES = {
  "north-america": ["Canada", "United States", "Bahamas", "Antigua and Barbuda", "Cayman Islands", "Puerto Rico", "Guadeloupe", , "Saint Kitts and Nevis", "Trinidad and Tobago", "Turks and Caicos Islands", "United States Virgin Islands"],
  "south-america": ["Argentina", "Chile", "Falkland Islands"],
  "europe": ["Russian Federation", "United Kingdom", "France", "Italy", "Greece", "Norway", "Denmark", "Cyprus", "Malta", "Faeroe Islands"],
  "africa": ["Angola", "Cape Verde", "Comoros", "Mauritius", "São Tomé and Principe", "Seychelles", "Canary Islands (Spain)"],
  "asia": ["China", "Japan", "Indonesia", "Malaysia", "Philippines", "Oman", "Azerbaijan", "Turkey"],
  "oceania": ["Australia", "New Zealand", "Papua New Guinea", "Fiji", "Solomon Islands", "Vanuatu", "New Caledonia", "French Polynesia", "Samoa", "American Samoa", "Kiribati", "Federated States of Micronesia", "Northern Mariana Islands", "Tonga"]
};

// build one lookup table: country → continent
const CONTINENT_OF = {};
for (const continent in CODES) {
  CODES[continent].split(" ").forEach(code => CONTINENT_OF[code] = continent);
  NAMES[continent].forEach(name => CONTINENT_OF[name] = continent);
}

fetch("assets/icons/world.svg")
  .then(res => {
    if (!res.ok) throw new Error("not found");
    return res.text();
  })
  .then(svgText => {
    const mapScreen = document.getElementById("map-screen");
    mapScreen.innerHTML = svgText;

    const svg = mapScreen.querySelector("svg");
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("aria-label", "World map. Choose a region to listen to.");

    // one clickable group per continent
    const groups = {};
    for (const key in CODES) {
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.id = key;
      g.classList.add("continent");
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", REGIONS[key].name);
      g.setAttribute("aria-pressed", "false");
      g.addEventListener("click", () => selectRegion(key));
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectRegion(key);
        }
      });
      svg.appendChild(g);
      groups[key] = g;
    }

    // move every country into its continent
    const unknown = new Set();
    svg.querySelectorAll("path").forEach(path => {
      const key = path.id || path.getAttribute("class");
      const continent = CONTINENT_OF[key];
      if (continent) {
        groups[continent].appendChild(path);
      } else {
        unknown.add(key);
        path.classList.add("land-other");
      }
    });

    if (unknown.size) console.warn("Countries without a continent:", [...unknown]);
    log("world map loaded · 6 regions");
  })
  .catch(() => log("could not load world.svg"));


// ===== GLOBE =====
const globe = document.getElementById("globe");
const GLOBE_SIZE = 140;
const GLOBE_MAP_W = GLOBE_SIZE * 2;
let currentKey = "world";

// turns the globe so this longitude faces the viewer
function pointGlobeAt(lon) {
  const mapX = ((lon + 180) / 360) * GLOBE_MAP_W;
  globe.style.backgroundPositionX = `${GLOBE_SIZE / 2 - mapX}px`;
}

function setGlobeTracking(on) {
  globe.classList.toggle("is-tracking", on);
}


// ===== BRIGHTNESS GRAPH =====
const graphCanvas = document.getElementById("graph");
let activeStrip = -1;

function drawGraph(active = activeStrip) {
  activeStrip = active;
  const w = graphCanvas.clientWidth;
  const h = graphCanvas.clientHeight;
  if (!w || !h) return;

  // sharp on high-resolution screens
  const dpr = window.devicePixelRatio || 1;
  graphCanvas.width = w * dpr;
  graphCanvas.height = h * dpr;
  const g = graphCanvas.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  // labels
  g.font = "16px VT323";
  g.fillStyle = "#CAC5E5";
  const topLabel = {
    change: "+ MORE LIGHT",
    brightness: `BRIGHTNESS ${currentYear}`,
    compare: `+ BRIGHTER ${yearLabel()}`
  }[currentMode];
  g.fillText(topLabel, 4, 14);
  if (currentMode !== "brightness") g.fillText("- LESS LIGHT", 4, h - 4);

  const top = 22;
  const bottom = h - 20;
  const mid = (top + bottom) / 2;
  const half = (bottom - top) / 2;

  // dashed center line (= no change)
  g.strokeStyle = "rgba(202, 197, 229, 0.3)";
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(0, mid);
  g.lineTo(w, mid);
  g.stroke();
  g.setLineDash([]);

  if (!strips.length) return;

  // one bar pair per strip
  const bw = w / STRIPS;
  strips.forEach((s, i) => {
    const x = i * bw + 1;
    const on = i === active;
    g.fillStyle = on ? "#F2E0A4" : "#B98BFF";              // gained: up
    g.fillRect(x, mid - s.gained * half, bw - 2, s.gained * half);
    g.fillStyle = on ? "#F2E0A4" : "#F5A35C";              // lost: down
    g.fillRect(x, mid, bw - 2, s.lost * half);
  });

  // playhead
  if (active >= 0) {
    g.strokeStyle = "#F2E0A4";
    g.beginPath();
    g.moveTo(active * bw + bw / 2, top);
    g.lineTo(active * bw + bw / 2, bottom);
    g.stroke();
  }
}

window.addEventListener("resize", () => drawGraph());


// ===== LIVE SCREENS: WAVEFORM + NOTES =====
const waveCanvas = document.getElementById("wave");
const notesCanvas = document.getElementById("notes");

// listens to everything going to the speakers
const waveform = new Tone.Waveform(512);
Tone.Destination.connect(waveform);

// sizes a canvas sharply and clears it
function fitCanvas(c) {
  const w = c.clientWidth;
  const h = c.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const g = c.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

// --- notes data ---
const MIDI_LOW = 36;   // C2, lowest stylophone note
const MIDI_HIGH = 81;  // A5, highest kalimba note
let noteParticles = [];
let lastNote = "--";

function spawnNotes(events) {
  events.forEach(e => {
    noteParticles.push({
      note: e.note,
      midi: Tone.Frequency(e.note).toMidi(),
      kind: e.kind,
      size: 3 + e.strength * 5,
      x: 1                // starts at the right edge (1 = 100%)
    });
    lastNote = e.note;
  });
}

// --- waveform screen ---
function drawWave() {
  const { g, w, h } = fitCanvas(waveCanvas);
  const mid = h / 2;

  // faint grid like an oscilloscope
  g.strokeStyle = "rgba(202, 197, 229, 0.12)";
  g.lineWidth = 1;
  for (let x = 0; x < w; x += 24) {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
  }
  for (let y = 0; y < h; y += 24) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }

  // the sound wave
  // only read the sound once audio is allowed (after the first click)
  const values = Tone.context.state === "running"
    ? waveform.getValue()
    : new Float32Array(512);
  g.strokeStyle = "#F2E0A4";
  g.lineWidth = 2;
  g.beginPath();
  values.forEach((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = mid - v * (h / 2) * 0.9;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  });
  g.stroke();
}

// --- notes screen (piano roll) ---
function drawNotes(dt) {
  const { g, w, h } = fitCanvas(notesCanvas);
  const top = 28;
  const bottom = h - 10;

  // staff lines
  g.strokeStyle = "rgba(202, 197, 229, 0.15)";
  g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    const y = top + ((bottom - top) / 4) * i;
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
  }

  // current note
  g.font = "18px VT323";
  g.fillStyle = "#CAC5E5";
  g.fillText(`NOTE  ${lastNote}`, 4, 18);

  const playing = Tone.Transport.state === "started";
  if (!playing && noteParticles.length === 0) {
    g.fillStyle = "rgba(202, 197, 229, 0.6)";
    g.fillText("WAITING FOR SIGNAL", 4, h / 2 + 6);
  }

  // move and draw every note
  noteParticles.forEach(p => {
    p.x -= dt / 4000;                    // crosses the screen in ~4 seconds
    const px = p.x * w;
    const py = bottom - ((p.midi - MIDI_LOW) / (MIDI_HIGH - MIDI_LOW)) * (bottom - top);
    const color = p.kind === "gain" ? "#B98BFF" : "#F5A35C";

    g.globalAlpha = 0.25;                // glow
    g.fillStyle = color;
    g.beginPath(); g.arc(px, py, p.size * 2, 0, Math.PI * 2); g.fill();

    g.globalAlpha = 1;                   // dot
    g.beginPath(); g.arc(px, py, p.size, 0, Math.PI * 2); g.fill();

    g.font = "14px VT323";               // note name
    g.fillStyle = "#F6FFE9";
    g.fillText(p.note, px + p.size + 3, py + 4);
  });

  noteParticles = noteParticles.filter(p => p.x > -0.05);
}

// --- one animation loop for both screens ---
let lastFrame = performance.now();

function animateScreens(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  drawWave();
  drawNotes(dt);
  requestAnimationFrame(animateScreens);
}

requestAnimationFrame(animateScreens);


// ===== FIELD REPORT PRINTER =====
const printBtn = document.getElementById("print-btn");
const paper = document.getElementById("paper");
let printing = false;

// recorded printer sound (Freesound, CC0)
const printerSound = new Tone.Player({
  url: "assets/sounds/printer.wav",
  loop: true
}).toDestination();
printerSound.volume.value = -24;   // much quieter than the music

// longitude at the center of a strip, as text
function lonOfStrip(i) {
  const centerX = regionBox.x + (i + 0.5) * (regionBox.w / STRIPS);
  const lon = Math.round(-180 + (centerX / regionBox.imgWidth) * 360);
  return lon < 0 ? `${-lon}°W` : `${lon}°E`;
}

// report for "what changed" (2012 → 2023)
function buildReport() {
  const T = 0.05; // same threshold the sound engine uses
  const gainStrips = strips.filter(s => s.gained > T).length;
  const lossStrips = strips.filter(s => s.lost > T).length;
  const silent = strips.filter(s => s.gained <= T && s.lost <= T).length;

  const totalGain = strips.reduce((sum, s) => sum + s.gained, 0);
  const totalLoss = strips.reduce((sum, s) => sum + s.lost, 0);

  let peakGain = 0, peakLoss = 0;
  strips.forEach((s, i) => {
    if (s.gained > strips[peakGain].gained) peakGain = i;
    if (s.lost > strips[peakLoss].lost) peakLoss = i;
  });

  // overall trend
  const ratio = totalGain / (totalGain + totalLoss || 1);
  let trend;
  if (totalGain + totalLoss < 0.5) trend = "Very little change was detected in this region.";
  else if (ratio > 0.7) trend = "Mostly BRIGHTER: new light clearly outweighs lost light.";
  else if (ratio < 0.3) trend = "Mostly DARKER: lost light outweighs new light.";
  else trend = "MIXED: some areas brightened while others dimmed.";

  const date = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const lines = [
    { type: "title", text: "EARTHLIGHT FM · FIELD REPORT" },
    { type: "meta", text: `${date} · Period 2012 → 2023` },
    { type: "meta", text: `Region: ${currentRegion.toUpperCase()}` },
    { type: "rule" },

    { type: "head", text: "01 · THE LIGHTS" },
    { type: "line", text: trend },
    { type: "line", text: `Brighter in ${gainStrips} of ${STRIPS} slices · dimmer in ${lossStrips} · no clear change in ${silent}.` }
  ];
  if (strips[peakGain].gained > T) lines.push({ type: "line", text: `Strongest growth near ${lonOfStrip(peakGain)}.` });
  if (strips[peakLoss].lost > T) lines.push({ type: "line", text: `Strongest loss near ${lonOfStrip(peakLoss)}.` });

  lines.push(
    { type: "rule" },
    { type: "head", text: "02 · WHY THIS MELODY?" },
    { type: "line", text: `The region was read west → east in ${STRIPS} slices, one beat per slice.` },
    { type: "line", text: `${gainStrips} kalimba notes = purple pixels, places that gained light. More growth plays a higher, louder note.` },
    { type: "line", text: `${lossStrips} stylophone notes = orange pixels, places that lost light. Low and buzzy, like a fading signal.` },
    { type: "line", text: `${silent} silences = no clear change: oceans, deserts, or places that stayed the same.` },
    { type: "line", text: "Every note comes from a pentatonic scale, so the data stays musical." },

    { type: "rule" },
    { type: "head", text: "03 · WHAT CAN CHANGE NIGHT LIGHTS" },
    { type: "line", text: "More light: growing cities, new roads and industry, homes getting electricity." },
    { type: "line", text: "Less light: conflict, disasters, power cuts, or people leaving an area." },
    { type: "line", text: "Note: switching to LED street lights can look dimmer to the satellite, even when nothing changed on the ground." },

    { type: "rule" },
    { type: "head", text: "04 · DATA" },
    { type: "line", text: "NASA Black Marble night lights (Suomi NPP VIIRS) · NASA SVS 5313 / 5276." },
    { type: "line", text: "Regions are approximate latitude/longitude boxes. Empty ocean at the edges is skipped." },
    { type: "end", text: "✦ END OF TRANSMISSION ✦" }
  );

  return lines;
}

// report for a single year
function buildYearReport() {
  const T = 0.05;
  const lit = strips.filter(s => s.gained > T).length;
  const dark = STRIPS - lit;

  let peak = 0;
  strips.forEach((s, i) => { if (s.gained > strips[peak].gained) peak = i; });

  const pct = Math.round(yearVs2023 * 100);
  const date = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const lines = [
    { type: "title", text: "EARTHLIGHT FM · FIELD REPORT" },
    { type: "meta", text: `${date} · Year ${currentYear}` },
    { type: "meta", text: `Region: ${currentRegion.toUpperCase()}` },
    { type: "rule" },

    { type: "head", text: "01 · THE LIGHTS" },
    { type: "line", text: `Lights detected in ${lit} of ${STRIPS} slices · dark in ${dark}.` },
    { type: "line", text: `Total light: ${pct}% of this region's 2023 level.` }
  ];
  if (strips[peak].gained > T) lines.push({ type: "line", text: `Brightest area near ${lonOfStrip(peak)}.` });

  lines.push(
    { type: "rule" },
    { type: "head", text: "02 · WHY THIS MELODY?" },
    { type: "line", text: `The region was read west → east in ${STRIPS} slices, one beat per slice.` },
    { type: "line", text: `${lit} kalimba notes = slices with lights. Brighter lights play higher, louder notes.` },
    { type: "line", text: `${dark} silences = no lights: oceans, deserts, empty land.` },
    { type: "line", text: "Every year is measured on the same scale as 2023, so a dimmer year plays lower and softer." },
    { type: "line", text: "Every note comes from a pentatonic scale, so the data stays musical." },

    { type: "rule" },
    { type: "head", text: "03 · DATA" },
    { type: "line", text: `NASA Black Marble night lights ${currentYear} (Suomi NPP VIIRS) · NASA SVS 5276.` },
    { type: "line", text: "Regions are approximate latitude/longitude boxes. Empty ocean at the edges is skipped." },
    { type: "end", text: "✦ END OF TRANSMISSION ✦" }
  );

  return lines;
}

printBtn.addEventListener("click", async () => {
  if (printing) return;
  if (!strips.length) {
    log("no data yet · select a region first");
    return;
  }
  await Tone.start();

  printing = true;
  printBtn.disabled = true;
  paper.innerHTML = "";
  paper.setAttribute("aria-busy", "true");   // screen readers wait until it's finished
  log(`printing report · ${currentRegion}`);
  if (printerSound.loaded) printerSound.start();

  const lines = { change: buildReport, brightness: buildYearReport, compare: buildCompareReport }[currentMode]();
  lines.forEach((l, i) => {
    setTimeout(() => {
      const el = document.createElement(l.type === "rule" ? "hr" : "p");
      el.className = `r-${l.type}`;
      if (l.text) el.textContent = l.text;
      paper.appendChild(el);

      if (i === lines.length - 1) {
        printerSound.stop();
        paper.setAttribute("aria-busy", "false"); // now it's read in one go
        printBtn.disabled = false;
        printing = false;
        log("report printed");
      }
    }, i * 140);
  });
});


// ===== YEARS (2012–2023 frames) =====
let changePixels = null;
let currentMode = "change";   // "change", "brightness" (1 year) or "compare" (2 years)
let currentYear = "change";   // the newest selected year
let picked = [];              // years in the order they were clicked
let selectedYears = [];       // the same years, sorted (older first)
let yearVs2023 = 1;           // single year: total light compared to 2023
let compareRatio = 1;         // two years: newer total light ÷ older total light
const yearCache = {};         // year → pixels, loaded only when needed

// loads a year's image once, resizes it to match the data map, then remembers it
function loadYearPixels(year) {
  if (yearCache[year]) return Promise.resolve(yearCache[year]);
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.src = `assets/images/lights-${year}.jpg`;
    im.onload = () => {
      const c = document.createElement("canvas");
      c.width = imgW;
      c.height = imgH;
      const cx = c.getContext("2d");
      cx.drawImage(im, 0, 0, imgW, imgH);
      if (im.width !== imgW) log(`${year}: resized ${im.width}x${im.height} → ${imgW}x${imgH}`);
      yearCache[year] = cx.getImageData(0, 0, imgW, imgH).data;
      resolve(yearCache[year]);
    };
    im.onerror = () => reject(new Error(`lights-${year}.jpg not found`));
  });
}

// text like "2012 → 2023", "2016" or "2012 → 2018"
function yearLabel() {
  if (currentMode === "change") return "2012 → 2023";
  if (currentMode === "compare") return `${selectedYears[0]} → ${selectedYears[1]}`;
  return `${currentYear}`;
}

// the strips for the current mode
function computeStrips(box) {
  if (currentMode === "change") {
    return analyzeRegion(changePixels, imgW, box, "change");
  }

  if (currentMode === "compare") {
    const [older, newer] = selectedYears;
    const a = analyzeRegion(yearCache[older], imgW, box, "brightness", true);
    const b = analyzeRegion(yearCache[newer], imgW, box, "brightness", true);

    const sumA = a.reduce((t, s) => t + s.gained, 0);
    const sumB = b.reduce((t, s) => t + s.gained, 0);
    compareRatio = sumA ? sumB / sumA : 1;

    // each strip measured by its OWN percentage change
    return b.map((s, i) => {
      const before = a[i].gained;
      const after = s.gained;
      if (before === 0 && after === 0) return { gained: 0, lost: 0 };   // dark both years

      const rel = (after - before) / Math.max(before, 0.0001);   // +0.2 = 20% brighter
      if (Math.abs(rel) < 0.05) return { gained: 0, lost: 0 };   // under 5% = no real change

      const strength = Math.min(1, Math.abs(rel) / 0.5);          // 50% or more = full strength
      return rel > 0 ? { gained: strength, lost: 0 } : { gained: 0, lost: strength };
    });
  }

  // single year: brightness scaled against 2023
  const yearRaw = analyzeRegion(yearCache[currentYear], imgW, box, "brightness", true);
  const refRaw = analyzeRegion(yearCache[2023], imgW, box, "brightness", true);
  const refMax = Math.max(...refRaw.map(s => s.gained), 0.0001);

  const yearSum = yearRaw.reduce((t, s) => t + s.gained, 0);
  const refSum = refRaw.reduce((t, s) => t + s.gained, 0);
  yearVs2023 = refSum ? yearSum / refSum : 1;

  return yearRaw.map(s => ({ gained: Math.min(1, s.gained / refMax), lost: 0 }));
}

// the year keys (+ What changed)
const yearKeys = document.querySelectorAll(".year-key");

yearKeys.forEach(key => key.addEventListener("click", async () => {
  const year = key.dataset.year;
  if (!changePixels) {
    log("NASA image still loading...");
    return;
  }

  if (year === "change") {
    picked = [];
  } else {
    const y = Number(year);
    if (currentMode === "change") picked = [];     // coming from What changed: start fresh

    if (picked.includes(y)) {
      if (picked.length === 1) return;             // keep at least one year
      picked = picked.filter(v => v !== y);        // click again = unselect
    } else {
      picked.push(y);
      if (picked.length > 2) picked.shift();       // a third year replaces the first one
    }
  }

  selectedYears = [...picked].sort((a, b) => a - b);

  try {
    if (selectedYears.length) {
      log(`loading ${selectedYears.join(" + ")}...`);
      await loadYearPixels(2023);                  // reference scale
      for (const y of selectedYears) await loadYearPixels(y);
    }
  } catch (err) {
    log(err.message);
    return;
  }

  if (selectedYears.length === 0) {
    currentMode = "change";
    currentYear = "change";
  } else {
    currentMode = selectedYears.length === 2 ? "compare" : "brightness";
    currentYear = selectedYears[selectedYears.length - 1];
  }

  // light up the selected keys
  yearKeys.forEach(k => {
    const on = k.dataset.year === "change"
      ? currentMode === "change"
      : selectedYears.includes(Number(k.dataset.year));
    k.setAttribute("aria-pressed", on);
  });

  globe.style.backgroundImage = `url("assets/images/lights-${currentYear}.jpg")`;
  selectRegion(currentKey);
  log(`mode: ${currentMode === "compare" ? "compare " : ""}${yearLabel()}`);
}));

// field report for two years
function buildCompareReport() {
  const T = 0.05;
  const [older, newer] = selectedYears;
  const gainStrips = strips.filter(s => s.gained > T).length;
  const lossStrips = strips.filter(s => s.lost > T).length;
  const silent = strips.filter(s => s.gained <= T && s.lost <= T).length;

  let peakGain = 0, peakLoss = 0;
  strips.forEach((s, i) => {
    if (s.gained > strips[peakGain].gained) peakGain = i;
    if (s.lost > strips[peakLoss].lost) peakLoss = i;
  });

  const pct = Math.round((compareRatio - 1) * 100);
  const totalText = pct === 0
    ? `Total light stayed about the same from ${older} to ${newer}.`
    : `Total light went ${pct > 0 ? "UP" : "DOWN"} ${Math.abs(pct)}% from ${older} to ${newer}.`;

  const date = new Date().toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const lines = [
    { type: "title", text: "EARTHLIGHT FM · FIELD REPORT" },
    { type: "meta", text: `${date} · Comparing ${older} → ${newer}` },
    { type: "meta", text: `Region: ${currentRegion.toUpperCase()}` },
    { type: "rule" },

    { type: "head", text: "01 · THE LIGHTS" },
    { type: "line", text: totalText },
    { type: "line", text: `Brighter in ${gainStrips} of ${STRIPS} slices · dimmer in ${lossStrips} · no clear change in ${silent}.` }
  ];
  if (strips[peakGain].gained > T) lines.push({ type: "line", text: `Strongest growth near ${lonOfStrip(peakGain)}.` });
  if (strips[peakLoss].lost > T) lines.push({ type: "line", text: `Strongest loss near ${lonOfStrip(peakLoss)}.` });

  lines.push(
    { type: "rule" },
    { type: "head", text: "02 · WHY THIS MELODY?" },
    { type: "line", text: `The region was read west → east in ${STRIPS} slices, one beat per slice.` },
    { type: "line", text: `${gainStrips} kalimba notes = slices that got brighter in ${newer}. A bigger increase plays a higher, louder note.` },
    { type: "line", text: `${gainStrips} kalimba notes = slices that got brighter in ${newer}. A bigger percentage change plays a higher, louder note.` },
    { type: "line", text: `${silent} silences = changes smaller than 5%, treated as no change.` },
    { type: "line", text: "Every note comes from a pentatonic scale, so the data stays musical." },

    { type: "rule" },
    { type: "head", text: "03 · WHAT CAN CHANGE NIGHT LIGHTS" },
    { type: "line", text: "More light: growing cities, new roads and industry, homes getting electricity." },
    { type: "line", text: "Less light: conflict, disasters, power cuts, or people leaving an area." },
    { type: "line", text: "Note: satellite readings vary a little from year to year (clouds, moonlight, sensor changes)." },

    { type: "rule" },
    { type: "head", text: "04 · DATA" },
    { type: "line", text: `NASA Black Marble night lights ${older} and ${newer} (Suomi NPP VIIRS) · NASA SVS 5276.` },
    { type: "line", text: "Regions are approximate latitude/longitude boxes. Empty ocean at the edges is skipped." },
    { type: "end", text: "✦ END OF TRANSMISSION ✦" }
  );

  return lines;
}

// ===== HOW IT WORKS POP-UP =====
const howDialog = document.getElementById("how");

// the "How it works" link in the header opens it
document.querySelectorAll('a[href="#how"]').forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    howDialog.showModal();
  });
});

document.getElementById("how-close").addEventListener("click", () => howDialog.close());

// "Start listening" closes it and jumps to the control room
document.getElementById("how-ok").addEventListener("click", () => {
  howDialog.close();
  document.getElementById("screens").scrollIntoView({ behavior: "smooth" });
});

// clicking the dark area outside the window closes it
howDialog.addEventListener("click", e => {
  if (e.target === howDialog) howDialog.close();
});

// show it automatically on the very first visit only
try {
  if (!localStorage.getItem("earthlight-seen-how")) {
    howDialog.showModal();
    localStorage.setItem("earthlight-seen-how", "yes");
  }
} catch (err) { /* storage blocked: skip the auto pop-up */ }
