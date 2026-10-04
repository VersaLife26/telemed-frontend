import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import toIco from "to-ico";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "app", "icon.svg"));

const png48 = await sharp(svg).resize(48, 48).png().toBuffer();
const png192 = await sharp(svg).resize(192, 192).png().toBuffer();
const ico = await toIco([png48]);

writeFileSync(join(root, "public", "favicon-48.png"), png48);
writeFileSync(join(root, "public", "apple-touch-icon.png"), png192);
writeFileSync(join(root, "public", "favicon.ico"), ico);
writeFileSync(join(root, "app", "favicon.ico"), ico);
