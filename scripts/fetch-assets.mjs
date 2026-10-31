// Télécharge les textures PBR et l'HDRI (licence CC0, Poly Haven) dans public/assets/.
// Usage : node scripts/fetch-assets.mjs     — à relancer seulement pour changer de ressources.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const TEXTURES = { wall: 'old_stone_wall', floor: 'checkered_pavement_tiles', wood: 'dark_planks' };
const HDRI = { env: 'small_cathedral' };
const MAPS = { Diffuse: 'diff', nor_gl: 'nor', Rough: 'rough', AO: 'ao' };

async function save(url, file) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
  console.log('saved', file.replace(OUT, 'assets'));
}

for (const [name, id] of Object.entries(TEXTURES)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  for (const [key, short] of Object.entries(MAPS)) {
    const u = files[key]?.['1k']?.jpg?.url;
    if (u) await save(u, join(OUT, 'tex', `${name}_${short}.jpg`)); else console.log('no', key, 'for', id);
  }
}
for (const [name, id] of Object.entries(HDRI)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  await save(files.hdri['1k'].hdr.url, join(OUT, 'hdri', `${name}_1k.hdr`));
}
