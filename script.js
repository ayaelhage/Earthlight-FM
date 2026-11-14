const img = new Image();
img.src = "assets/images/lights-change.jpg";

img.onload = () => {
  // 1. Invisible canvas to READ the pixels
  const reader = document.createElement("canvas");
  reader.width = img.width;
  reader.height = img.height;
  const readerCtx = reader.getContext("2d");
  readerCtx.drawImage(img, 0, 0);
  const pixels = readerCtx.getImageData(0, 0, img.width, img.height).data;

  // 2. Visible canvas to DRAW the dots
  const canvas = document.getElementById("dots");
  const ctx = canvas.getContext("2d");
  canvas.width = img.width;
  canvas.height = img.height;

  // 3. Check the image every few pixels
  const step = 5;

  for (let y = 0; y < img.height; y += step) {
    for (let x = 0; x < img.width; x += step) {
      const i = (y * img.width + x) * 4;
      const brightness = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;

      if (brightness > 20) {
        const size = (brightness / 255) * (step / 2);
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = "#F2E0A4";
        ctx.fill();
      }
    }
  }
};