import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public/chronicle');
const sourceImage = join(publicDir, 'ChronicleFavicon.png');

// Background color #2b2b2b
const background = { r: 0x2b, g: 0x2b, b: 0x2b };

async function generateFavicons() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  // Generate resized PNGs
  for (const size of sizes) {
    const buffer = await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background })
      .flatten({ background })
      .png({ quality: 90, compressionLevel: 9 })
      .toBuffer();
    pngBuffers.push(buffer);
    
    // Also save individual PNGs for apple-touch-icon etc
    if (size === 32) {
      await sharp(sourceImage)
        .resize(size, size, { fit: 'contain', background })
        .flatten({ background })
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(join(publicDir, 'favicon-32x32.png'));
    }
  }

  // Create ICO from the PNG buffers
  const icoBuffer = await pngToIco(pngBuffers);
  writeFileSync(join(publicDir, 'favicon.ico'), icoBuffer);

  console.log('✓ Generated favicon.ico (16x16, 32x32, 48x48)');
  console.log('✓ Generated favicon-32x32.png');
}

generateFavicons().catch(console.error);
