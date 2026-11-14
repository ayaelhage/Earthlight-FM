# Earthlight FM 📻
**Every light is a person, a home, a sound.**

Earthlight FM turns NASA's Black Marble night lights into music, so anyone — including blind and low-vision users — can experience how our planet changed between 2012 and 2023.

Built solo for the **2026 NASA Space Apps Challenge** · Challenge: *The Earth Information Jukebox* · Local event: Tripoli, Lebanon.

🔗 **Live site:**  https://ayaelhage.github.io/Earthlight-FM/

---

## How it works
1. The NASA night lights image is read pixel by pixel in the browser (HTML Canvas).
2. A selected region is cut into 32 vertical slices, read west → east, one beat per slice.
3. **What changed (2012 → 2023):** purple pixels (more light) play a **kalimba**; orange pixels (less light) play a **stylophone**. Silence means no clear change.
4. **Single years:** brighter lights play higher, louder notes, measured on the same scale as 2023.
5. Every note comes from a pentatonic scale, so the data stays musical.
6. The field report printer explains each melody using the same numbers the music uses.

## Features
- Clickable continent map (mouse and keyboard)
- Year selector 2012–2023 + "What changed" track
- Live screens: globe, brightness graph, waveform, notes, system log
- Data-driven field report printer
- Accessibility: keyboard controls, screen-reader announcements, text explanations, color key that doesn't rely on color alone

## Data
- NASA Black Marble night lights (Suomi NPP VIIRS)
- NASA Scientific Visualization Studio: SVS 5313 (EIC version), SVS 5276 (source frames)
- Regions are approximate latitude/longitude boxes; empty ocean at the edges is skipped.

## Built with
HTML, CSS, JavaScript · [Tone.js](https://tonejs.github.io/) (MIT)

## Credits
- World map: [simplemaps](https://simplemaps.com) (free for commercial and personal use)
- Icons: [Lucide](https://lucide.dev) (ISC)
- Fonts: Darumadrop One, Space Grotesk, Space Mono, VT323, via Google Fonts (SIL OFL)
- Printer sound: Freesound (CC0), *Freesound - epson receipt printer3 by azumarill*

## Use of AI
As a solo developer working within 48 hours, I used AI (mainly Claude) for planning, explaining new tools like Tone.js and the Canvas API, generating and refining code, and debugging. The concept, design, art direction and sound identity are my own, and I reviewed and understood every part of the code.

## Run locally
Open the folder in VS Code and use the **Live Server** extension (opening `index.html` directly blocks reading the image pixels).

---
Made by **Aya El Hage** · NASA Space Apps 2026