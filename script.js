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
  nasaPixels = pixels;
  imgW = img.width;
  imgH = img.height;
  log("NASA SVS 5276 · night lights loaded");
  log(`image ${img.width} x ${img.height} px`);
  selectRegion("world");
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