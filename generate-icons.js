// ============================================================
// NEUROSTEP — Icon Generator (Node.js)
// Jalankan: node generate-icons.js
// Butuh: npm install canvas
// ============================================================
// Jika tidak mau install Node, gunakan generate-icons.html
// (buka di browser, klik Download Semua Icon)
// ============================================================

const { createCanvas } = require("canvas");
const fs = require("fs");
const path = require("path");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUT_DIR = path.join(__dirname, "icons");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  const r = size * 0.18;

  // Background rounded rect
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();

  // Gradient background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, "#1677d8");
  grad.addColorStop(1, "#0e4f9e");
  ctx.fillStyle = grad;
  ctx.fill();

  // Lingkaran dekorasi kanan bawah
  ctx.beginPath();
  ctx.arc(size * 0.85, size * 0.85, size * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(97, 183, 255, 0.18)";
  ctx.fill();

  // Teks "NS"
  const fontSize = Math.round(size * 0.38);
  ctx.font = `800 ${fontSize}px Arial`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NS", size / 2, size / 2);

  return canvas;
}

SIZES.forEach((size) => {
  const canvas = drawIcon(size);
  const filePath = path.join(OUT_DIR, `icon-${size}x${size}.png`);
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(filePath, buffer);
  console.log(`✅ icons/icon-${size}x${size}.png`);
});

console.log("\nSemua icon berhasil dibuat di folder icons/");
