import sharp from 'sharp';
import { Buffer } from 'buffer';

// Brand: #2F5BFF rounded-square + white V chevron
// SVG rendered at 512x512 for clean downscaling
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="115" fill="#2F5BFF"/>
  <polyline
    points="128,148 256,368 384,148"
    fill="none"
    stroke="#ffffff"
    stroke-width="56"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>`;

const svgBuffer = Buffer.from(SVG);

const icons = [
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-32x32.png',    size: 32  },
  { file: 'public/favicon-16x16.png',    size: 16  },
];

for (const { file, size } of icons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(file);
  console.log(`✓ ${file} (${size}x${size})`);
}

console.log('\nAll icons generated.');
