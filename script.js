// ===== HERO: high-detail night lights (visual only) =====
const heroImg = new Image();
heroImg.src = "assets/images/lights-change-hd.jpg";

heroImg.onload = () => {
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

  const step = 8;        // size of each grid cell (bigger image → finer dots)
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
  log("hero map drawn · high detail");
};

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
  const played = [];   // text for the log
  const events = [];   // data for the notes screen

  if (s.gained > 0.05) {
    const note = pickNote(KALIMBA_NOTES, s.gained);
    kalimba.triggerAttackRelease(note, "8n", time, 0.3 + s.gained * 0.7);
    played.push(`+light ${note}`);
    events.push({ note, kind: "gain", strength: s.gained });
  }

  if (s.lost > 0.05) {
    const note = pickNote(STYLO_NOTES, s.lost);
    stylophone.triggerAttackRelease(note, "16n", time, 0.3 + s.lost * 0.7);
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

// ===== REGIONS (latitude / longitude boxes) =====
let nasaPixels = null;
let imgW = 0;
let imgH = 0;

const REGIONS = {
  "world":         { name: "the whole world", west: -180, east: 180, north: 90, south: -90 },
  "north-america": { name: "North America",   west: -170, east: -50, north: 84, south: 7 },
  "south-america": { name: "South America",   west: -92,  east: -32, north: 13, south: -56 },
  "europe":        { name: "Europe",          west: -25,  east: 45,  north: 72, south: 34 },
  "africa":        { name: "Africa",          west: -20,  east: 55,  north: 38, south: -36 },
  "asia":          { name: "Asia",            west: 45,   east: 180, north: 78, south: -11 },
  "oceania":       { name: "Oceania",         west: 110,  east: 180, north: 0,  south: -48 }
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

function selectRegion(key) {
  if (!nasaPixels) {
    log("NASA image still loading...");
    return;
  }
  const r = REGIONS[key];
  currentRegion = r.name;
  regionBox = regionToBox(r);
  strips = analyzeRegion(nasaPixels, imgW, regionBox);
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
  "europe":        "AL AT BY BE BA BG HR CZ EE FI DE HU IS IE XK LV LT LU MK MD ME NL PL PT RO RS SK SI ES SE CH UA",
  "africa":        "DZ BJ BW BF BI CM CF TD CI CD DJ EG GQ ER ET GA GH GN GW KE LS LR LY MG MW ML MR YT MA MZ NA NE NG CG RE RW SN SL SO ZA SS SD SZ TZ GM TG TN UG EH ZM ZW",
  "asia":          "AF AM BH BD BT BN KH KP GE IN IR IQ IL JO KZ KW KG LA LB MV MN MM NP PK PS QA KR SA LK SY TW TJ TH TL TM AE UZ VN YE",
  "oceania":       "GU MH NR PW TV"
};

// countries in SEVERAL pieces use their name (class)
const NAMES = {
  "north-america": ["Canada", "United States", "Bahamas", "Antigua and Barbuda", "Cayman Islands", "Puerto Rico", "Saint Kitts and Nevis", "Trinidad and Tobago", "Turks and Caicos Islands", "United States Virgin Islands"],
  "south-america": ["Argentina", "Chile", "Falkland Islands"],
  "europe":        ["Russian Federation", "United Kingdom", "France", "Italy", "Greece", "Norway", "Denmark", "Cyprus", "Malta", "Faeroe Islands"],
  "africa":        ["Angola", "Cape Verde", "Comoros", "Mauritius", "Sao Tome and Principe", "Seychelles", "Canary Islands (Spain)"],
  "asia":          ["China", "Japan", "Indonesia", "Malaysia", "Philippines", "Oman", "Azerbaijan", "Turkey"],
  "oceania":       ["Australia", "New Zealand", "Papua New Guinea", "Fiji", "Solomon Islands", "Vanuatu", "New Caledonia", "French Polynesia", "Samoa", "American Samoa", "Kiribati", "Federated States of Micronesia", "Northern Mariana Islands", "Tonga"]
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
  g.fillText("+ MORE LIGHT", 4, 14);
  g.fillText("- LESS LIGHT", 4, h - 4);

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
  const values = waveform.getValue();
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