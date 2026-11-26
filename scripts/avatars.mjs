import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Keep the original pixel density for small avatars; 256px covers the site's high-DPI cards.
export async function prepareAvatar(sourcePath, outputDirectory, login) {
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(login) || login.includes('--')) {
    throw new Error(`无效的 GitHub 用户名：${login}`);
  }
  const { width, height, hasAlpha } = await sharp(sourcePath).metadata();
  const side = Math.min(width, height, 256);
  const square = sharp(sourcePath).autoOrient().resize(side, side, { fit: 'cover', position: 'centre' });
  const filename = `${login}.${hasAlpha ? 'avif' : 'webp'}`;
  await mkdir(outputDirectory, { recursive: true });
  const encoded = hasAlpha ? square.avif({ quality: 80 }) : square.webp({ quality: 75 });
  await encoded.toFile(path.join(outputDirectory, filename));
  return filename;
}

if (import.meta.main) {
  const outputDirectory = fileURLToPath(new URL('../upload/avatars/', import.meta.url));
  await mkdir(outputDirectory, { recursive: true });
  const sources = fileURLToPath(new URL('../src/assets/images/avatars/', import.meta.url));
  for (const file of (await readdir(sources)).sort()) {
    if (!/\.(png|jpe?g|avif|webp)$/i.test(file)) continue;
    const login = file === 'default_avatar.png' ? 'default' : path.parse(file).name;
    const name = await prepareAvatar(path.join(sources, file), outputDirectory, login);
    console.log(`upload/avatars/${name}`);
  }
}
