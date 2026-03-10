const fs = require('fs');
const path = require('path');

// Create assets directory
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple 256x256 PNG (1x1 red pixel) as placeholder
// In real scenario, replace with proper icons
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), pngBuffer);

console.log('Placeholder icon created at assets/icon.png');
console.log('NOTE: Please replace with proper icons before release.');
