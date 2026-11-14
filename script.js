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

        // 5. Brighter light = bigger, more visible dot with glow
        const size = 0.8 + (best / 255) * (step * 0.45);
        ctx.globalAlpha = 0.35 + (best / 255) * 0.65;
        ctx.shadowColor = color;
        ctx.shadowBlur = best / 25;
        ctx.fillStyle = color;

        ctx.beginPath();
        ctx.arc(x + step / 2, y + step / 2, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};

img.onerror = () => console.log("Image NOT found. Check the name and folder!");

// ON AIR / STANDBY indicator
const onAir = document.getElementById("on-air");
const onAirText = document.getElementById("on-air-text");

function setOnAir(isLive) {
  onAir.classList.toggle("is-live", isLive);
  onAirText.textContent = isLive ? "On air" : "Standby";
}