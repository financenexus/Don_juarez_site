import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".php",
  ".txt",
  ".xml",
  ".yml",
]);
const ignoredDirectories = new Set([".git", "node_modules"]);
const failures = [];
const textFiles = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;

    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(file);
    } else if (
      textExtensions.has(path.extname(entry.name).toLowerCase()) ||
      entry.name === ".htaccess"
    ) {
      textFiles.push(file);
    }
  }
}

walk(root);

const mojibakeTokens = [
  "\u00c3\u00ad",
  "\u00c3\u00a7",
  "\u00c3\u00a3",
  "\u00c3\u00a9",
  "\u00c3\u00aa",
  "\u00c3\u00b3",
  "\u00c3\u00ba",
  "\u00c3\u00b5",
  "\u00c2\u00b7",
  "\u00e2\u20ac",
  "\ufffd",
];

for (const file of textFiles) {
  const source = fs.readFileSync(file, "utf8");
  const found = mojibakeTokens.filter((token) => source.includes(token));
  if (found.length) {
    failures.push(
      `${path.relative(root, file)} contains corrupted encoding: ${found.join(", ")}`,
    );
  }
}

const homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
if (!/<meta\s+charset=["']utf-8["']/i.test(homepage)) {
  failures.push("index.html must declare UTF-8.");
}

const bundleMatch = homepage.match(
  /<script[^>]+src=["'](\/assets\/index-[^"']+\.js)["']/i,
);
if (!bundleMatch) {
  failures.push("index.html does not reference the site JavaScript bundle.");
} else {
  const bundlePath = path.join(root, bundleMatch[1].slice(1));
  if (!fs.existsSync(bundlePath)) {
    failures.push(`Missing JavaScript bundle: ${bundleMatch[1]}`);
  } else {
    const bundle = fs.readFileSync(bundlePath, "utf8");
    const requiredPhrases = [
      "Início",
      "Presença e textura",
      "Cuidado e seleção",
      "Detalhe da matéria-prima",
      "Apresentação",
      "Identidade premium",
    ];

    for (const phrase of requiredPhrases) {
      if (!bundle.includes(phrase)) {
        failures.push(`JavaScript bundle is missing: ${phrase}`);
      }
    }

    const galleryPaths = [
      ...new Set(bundle.match(/\/assets\/gallery-[^"']+\.jpg/g) || []),
    ];
    if (galleryPaths.length !== 6) {
      failures.push(`Expected 6 gallery images, found ${galleryPaths.length}.`);
    }

    for (const imagePath of galleryPaths) {
      const file = path.join(root, imagePath.slice(1));
      if (!fs.existsSync(file)) {
        failures.push(`Missing gallery image: ${imagePath}`);
        continue;
      }

      const bytes = fs.readFileSync(file);
      const isJpeg =
        bytes.length > 1_000 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes.at(-2) === 0xff &&
        bytes.at(-1) === 0xd9;
      if (!isJpeg) failures.push(`Invalid JPEG file: ${imagePath}`);
    }
  }
}

for (const file of textFiles.filter((item) => item.endsWith(".html"))) {
  const html = fs.readFileSync(file, "utf8");
  for (const match of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+)["']/g)) {
    const publicPath = decodeURIComponent(match[1]);
    if (publicPath.startsWith("//")) continue;

    let target = path.join(root, publicPath.slice(1));
    if (publicPath.endsWith("/")) target = path.join(target, "index.html");
    if (!fs.existsSync(target)) {
      failures.push(
        `${path.relative(root, file)} references missing file: ${publicPath}`,
      );
    }
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `PASS: ${textFiles.length} text files, UTF-8 Portuguese, local links, bundle, and gallery assets.`,
);
