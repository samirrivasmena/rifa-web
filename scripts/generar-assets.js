const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const pngToIcoModule = require("png-to-ico");
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const publicDir = path.join(__dirname, "../public");
const input = path.join(publicDir, "logo-original.png");

async function makePng(size, filename) {
  await sharp(input)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(publicDir, filename));
}

async function main() {
  // PNGs
  await makePng(32, "logo-32x32.png");
  await makePng(192, "logo-192x192.png");
  await makePng(512, "logo-512x512.png");
  await makePng(180, "apple-touch-icon.png");

  // logo principal
  await sharp(input)
    .resize(1024, 1024, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(path.join(publicDir, "logo.png"));

  // OG image 1200x630
  const ogBg = sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 4,
      background: "#111111",
    },
  });

  const logoForOg = await sharp(input)
    .resize(520, 520, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  await ogBg
    .composite([
      {
        input: logoForOg,
        gravity: "center",
      },
    ])
    .png()
    .toFile(path.join(publicDir, "og-image.png"));

  // favicon.ico
  const icoBuffers = await Promise.all([
    sharp(input)
      .resize(16, 16, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
    sharp(input)
      .resize(32, 32, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
    sharp(input)
      .resize(48, 48, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer(),
  ]);

  const ico = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(publicDir, "favicon.ico"), ico);

  console.log("✅ Archivos generados correctamente en /public");
}

main().catch((err) => {
  console.error("❌ Error generando assets:", err);
});