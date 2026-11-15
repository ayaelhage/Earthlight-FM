# Earthlight FM 📻
**Every light is a person, a home, a sound.**

Earthlight FM turns NASA's Black Marble night lights into music, so anyone, including blind and low-vision users, can experience how our planet changed between 2012 and 2023.

Built solo for the **2026 NASA Space Apps Challenge** · Challenge: *The Earth Information Jukebox* · Local event: Tripoli, Lebanon.

🔗 **Live site:** [ayaelhage.github.io/Earthlight-FM](https://ayaelhage.github.io/Earthlight-FM/)

📒 **Project documentation:** [Read it on Notion](https://app.notion.com/p/Earthlight-FM-NASA-416191fcce6d8099bc3af80c1b6b07f1#416191fcce6d80d780fbf92c98775937)

---

## The idea
NASA's Earth Information Center shows beautiful visualizations of our changing planet, but only to people who can see them. Earthlight FM translates sight into sound: the lights of cities become melodies, and the places where light faded become a low, buzzy signal.

## How it works
1. NASA's night lights images are read pixel by pixel in the browser (HTML Canvas).
2. The selected region is cut into **32 vertical slices**, read west → east, one beat per slice.
3. Three listening modes:
   - **What changed (2012 → 2023):** purple pixels (more light) play a **kalimba**; orange pixels (less light) play a **stylophone**.
   - **One year:** brighter lights play higher, louder kalimba notes, measured on the same scale as 2023 so years can be compared.
   - **Two years:** each slice is measured by its own percentage change. Brighter → kalimba, dimmer → stylophone. Changes under 5% are treated as noise and stay silent.
4. Every note comes from a **pentatonic scale**, so the data stays musical.
5. A **field report printer** explains each melody using the same numbers the music uses.

## Features
- Clickable continent map (mouse and keyboard)
- Year selector 2012–2023, two-year comparison, and "What changed" track
- Live control room: spinning globe, brightness graph, waveform, notes screen, system log
- Data-driven field report printer
- "How it works" retro pop-up
- Credits page with a spaceship window and zero-gravity credits
- Responsive layout for phones

## Accessibility
- Every control works with the keyboard (Tab, Enter, Space, Esc)
- Screen readers hear what is playing, which year and region is selected, and the full printed report
- The map key and sound key use text, not color alone
- Respects "reduce motion" settings
- Readable color contrast throughout

## Data
- NASA Black Marble night lights (Suomi NPP VIIRS)
- NASA Scientific Visualization Studio: **SVS 5313** (Earth Information Center version) and **SVS 5276** (source frames, 2012–2023)
- Regions are approximate latitude/longitude boxes; empty ocean at the edges is skipped
- Year-to-year satellite readings vary slightly (clouds, moonlight, sensor changes), which is why small changes are ignored

## Built with
HTML, CSS, JavaScript · [Tone.js](https://tonejs.github.io/) (MIT)

## Credits
- World map: [simplemaps](https://simplemaps.com) (free for commercial and personal use)
- Icons: [Lucide](https://lucide.dev) (ISC)
- Fonts: Darumadrop One, Space Grotesk, Space Mono, VT323 via Google Fonts (SIL OFL)
- Instrument panel photo: NASA *(https://images.nasa.gov/details/E63-10169 --> ID: E63-10169)*
- Printer sound: Freesound, CC0 *https://freesound.org/people/azumarill/sounds/345056/*

## Use of AI
As a solo developer working within 48 hours, I used AI (mainly Claude) for planning, explaining new tools like Tone.js and the Canvas API, generating and refining code, and debugging. The concept, design, art direction and sound identity are my own, and I reviewed and understood every part of the code.

## Run locally
Open the folder in VS Code and use the **Live Server** extension. Opening `index.html` directly blocks reading the image pixels.

---
Made by **Aya El Hage** · NASA Space Apps 2026
