// Generates game art via the AI proxy, removes the flat background and writes optimized WebP files.
// Usage: node scripts/gen-assets.mjs [--force] [key ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "art-src");
const OUT_DIR = path.join(ROOT, "public", "assets");

function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv();

const BASE = process.env.AI_PROXY_BASE_URL;
const KEY = process.env.AI_PROXY_API_KEY;
const MODEL = process.env.AI_IMAGE_MODEL || "gemini-3.1-flash-image";
const FAL_KEY = process.env.FAL_KEY;
const FAL_MODEL = process.env.FAL_IMAGE_MODEL || "fal-ai/gemini-3.1-flash-image-preview";
// The proxy is the primary provider. fal.ai is a temporary stand-in, used only when explicitly
// requested: IMAGE_PROVIDER=fal (fal only) or IMAGE_FALLBACK=fal (proxy first, fal on failure).
const PROVIDER = process.env.IMAGE_PROVIDER || "proxy";
const FALLBACK_TO_FAL = process.env.IMAGE_FALLBACK === "fal";
if (PROVIDER === "proxy" && (!BASE || !KEY)) {
  console.error("Missing AI_PROXY_BASE_URL / AI_PROXY_API_KEY in .env.local");
  process.exit(1);
}
if ((PROVIDER === "fal" || FALLBACK_TO_FAL) && !FAL_KEY) {
  console.error("Missing FAL_KEY in .env.local");
  process.exit(1);
}

const STYLE =
  "2D cozy cartoon game art, soft warm pastel colors, clean dark-brown outlines, simple cel shading, cute and friendly, consistent storybook style.";
const SPRITE =
  "Single object only, centered, front three-quarter view, isolated on a perfectly plain pure white background. No shadow, no ground, no text, no extra objects.";
const CAT_BASE =
  "Full body anthropomorphic cat character that stands upright and walks on two legs like a person, cartoon proportions with big head, cat ears, whiskers, tail visible, front paws used like hands. Standing pose facing the viewer, whole body including feet visible. Isolated on a perfectly plain pure white background, no shadow, no ground, no grass, no text.";

const CATS = {
  student:
    "Young orange tabby cat student wearing a mint-and-cream striped sweater, light blue backpack and blue rain boots, energetic.",
  office:
    "Grey tabby cat office worker wearing a white shirt, navy tie, dark trousers and round glasses, holding a smartphone in one paw, busy look.",
  regular:
    "Friendly calico cat (white, orange and black patches) wearing a cozy pink knitted cardigan and a small brown beret, warm gentle smile.",
  picky:
    "Elegant fluffy white Persian cat with a lavender coat, a pearl necklace and a tiny handbag, refined and slightly haughty posture.",
};
const MOODS = {
  happy: "very happy joyful expression, closed smiling eyes, big open smile, paws raised a little in delight",
  sad: "disappointed sad expression, droopy ears, frowning mouth, slumped shoulders",
  impatient: "impatient annoyed expression, furrowed brows, one paw tapping or looking at wrist, small frown",
};

/** @type {{key:string,prompt:string,aspect:string,kind:'bg'|'sprite',max:number,ref?:string}[]} */
const ASSETS = [
  {
    key: "bg_room",
    kind: "bg",
    aspect: "9:16",
    max: 1080,
    prompt: `${STYLE} Vertical background illustration: interior of a cozy boba tea shop seen from the barista's position behind the counter. Show the customer side of the shop: wooden floor, entrance door, big window, hanging plants, string lights, pastel walls, shelves and empty menu boards. The floor area in the middle is completely empty and open. Absolutely no people, no animals, no characters, no counter in the foreground, no readable text.`,
  },
  {
    key: "counter_front",
    kind: "sprite",
    aspect: "21:9",
    max: 1280,
    prompt: `${STYLE} Flat 2D game asset: a long thin horizontal plank that is the rounded top rail of a wooden bar counter, seen straight from the front with no perspective, perfectly straight and level, running from the left edge of the image to the right edge, warm honey wood grain, dark-brown outline, lighter highlight along the top. The plank is short in height, about one tenth of the image height, centered vertically. Nothing else: no room, no background scene, no objects, no text, isolated on a perfectly plain pure white background, no shadow.`,
  },
  {
    key: "worktop",
    kind: "bg",
    aspect: "1:1",
    max: 900,
    prompt: `${STYLE} Seamless top-down texture of a light warm wooden kitchen worktop with soft plank lines, plain, nothing on it, no objects, no text, evenly lit.`,
  },
  { key: "cup_stack", kind: "sprite", aspect: "1:1", max: 360, prompt: `${STYLE} A tall stack of empty clear plastic boba tea cups. ${SPRITE}` },
  {
    key: "tea_black",
    kind: "sprite",
    aspect: "1:1",
    max: 380,
    prompt: `${STYLE} A cute stainless steel tea dispenser urn with a front tap, a glass window showing dark reddish-brown black tea inside, and a round brown label with a tea leaf icon. ${SPRITE}`,
  },
  {
    key: "tea_green",
    kind: "sprite",
    aspect: "1:1",
    max: 380,
    prompt: `${STYLE} A cute stainless steel tea dispenser urn with a front tap, a glass window showing light green jasmine green tea inside, and a round green label with a leaf icon. ${SPRITE}`,
  },
  {
    key: "tea_oolong",
    kind: "sprite",
    aspect: "1:1",
    max: 380,
    prompt: `${STYLE} A cute stainless steel tea dispenser urn with a front tap, a glass window showing golden amber oolong tea inside, and a round orange label with a leaf icon. ${SPRITE}`,
  },
  { key: "milk", kind: "sprite", aspect: "1:1", max: 340, prompt: `${STYLE} A cute white ceramic milk jug pitcher with a blue cow-spot pattern, full of milk. ${SPRITE}` },
  {
    key: "sugar",
    kind: "sprite",
    aspect: "1:1",
    max: 340,
    prompt: `${STYLE} A clear bottle of golden brown sugar syrup with a black pump dispenser on top and a cute cream label. ${SPRITE}`,
  },
  { key: "ice", kind: "sprite", aspect: "1:1", max: 360, prompt: `${STYLE} A small stainless ice bin full of clear ice cubes with a metal scoop resting in it. ${SPRITE}` },
  {
    key: "top_boba",
    kind: "sprite",
    aspect: "1:1",
    max: 320,
    prompt: `${STYLE} A round ceramic bowl full of glossy dark brown tapioca pearls (boba) with a small slotted spoon. ${SPRITE}`,
  },
  {
    key: "top_jelly",
    kind: "sprite",
    aspect: "1:1",
    max: 320,
    prompt: `${STYLE} A round ceramic bowl full of translucent green coconut jelly cubes with a small spoon. ${SPRITE}`,
  },
  {
    key: "top_pudding",
    kind: "sprite",
    aspect: "1:1",
    max: 320,
    prompt: `${STYLE} A round ceramic bowl full of soft yellow egg custard pudding pieces with caramel, with a small spoon. ${SPRITE}`,
  },
  {
    key: "sealer",
    kind: "sprite",
    aspect: "1:1",
    max: 380,
    prompt: `${STYLE} A cute compact pastel pink boba cup sealing machine with a lever handle on top and a cup slot in front. ${SPRITE}`,
  },
  { key: "trash", kind: "sprite", aspect: "1:1", max: 280, prompt: `${STYLE} A small mint green pedal trash bin with a lid. ${SPRITE}` },
  { key: "coin", kind: "sprite", aspect: "1:1", max: 128, prompt: `${STYLE} A shiny gold coin with a paw print engraved in the middle, game currency icon. ${SPRITE}` },
  { key: "star", kind: "sprite", aspect: "1:1", max: 128, prompt: `${STYLE} A cute plump yellow star with a tiny smile, game reputation icon. ${SPRITE}` },
  {
    key: "logo",
    kind: "sprite",
    aspect: "1:1",
    max: 720,
    prompt: `${STYLE} Game title illustration: a cute orange anthropomorphic cat barista in a pink apron standing on two legs and holding up a big boba milk tea cup with a straw, surrounded by floating tapioca pearls and little sparkles. ${SPRITE}`,
  },
];

for (const [id, desc] of Object.entries(CATS)) {
  ASSETS.push({ key: `cat_${id}_idle`, kind: "sprite", aspect: "3:4", max: 640, prompt: `${STYLE} ${CAT_BASE} ${desc} Calm content neutral expression, slight smile.` });
  for (const [mood, moodDesc] of Object.entries(MOODS)) {
    ASSETS.push({
      key: `cat_${id}_${mood}`,
      kind: "sprite",
      aspect: "3:4",
      max: 640,
      ref: `cat_${id}_idle`,
      prompt: `Edit this image: keep the exact same cat character, same fur pattern, same outfit and accessories, same art style, same framing and size, still standing upright on two legs with the whole body visible. Change only the expression and pose to: ${moodDesc}. Keep the perfectly plain pure white background, no shadow, no ground.`,
    });
  }
}

const ICON = "Small game UI icon, bold simple shape readable at small size, chunky dark-brown outline.";
const DOG =
  "Chubby anthropomorphic shiba-style dog character that stands upright and walks on two legs like a person, cartoon proportions with big head, wearing black sunglasses and a red apron with a bone logo, smug mischievous grin. Whole body visible.";
const icon = (key, desc) => ({ key, kind: "sprite", aspect: "1:1", max: 192, prompt: `${STYLE} ${ICON} ${desc} ${SPRITE}` });
ASSETS.push(
  icon("icon_sunny", "A smiling round sun with short rays."),
  icon("icon_hot", "A blazing orange sun melting a little, with heat wave lines and a sweat drop."),
  icon("icon_rainy", "A soft grey-blue rain cloud with three falling raindrops."),
  icon("icon_cloudy", "Two fluffy overlapping pastel grey clouds."),
  icon("icon_festival", "A glowing red Vietnamese paper lantern with gold tassel."),
  icon("icon_goal", "A small red and white archery target with an arrow in the bullseye."),
  icon("icon_combo", "A cute orange flame with a happy face."),
  icon("icon_lock", "A small closed golden padlock."),
  icon("icon_camera", "A white wall-mounted security CCTV camera with a red light."),
  icon("icon_safe", "A small sturdy dark green steel safe with a round dial."),
  icon("icon_bank", "A pastel pink piggy bank with a gold coin going into the slot."),
  icon("icon_moon", "A crescent moon sleeping with a little nightcap, two tiny stars."),
  icon("icon_sunrise", "A sun rising over a small cozy shop roof, warm morning colors."),
  icon("icon_critic", "A retro camera with a small notepad and pen, food reviewer equipment."),
  icon("icon_discount", "A red price tag with a big percent sign."),
  icon("icon_wrench", "A grey wrench crossed with a dripping water pipe."),
  icon("icon_mic", "A loud karaoke microphone with sound waves."),
  icon("icon_bankrupt", "A shop door with wooden boards nailed across it and a paper notice with a red stamp."),
  icon("trash_can", "A crushed red soda can lying on its side."),
  icon("trash_banana", "A yellow banana peel lying flat."),
  icon("trash_paper", "A crumpled old newspaper ball."),
  icon("trash_box", "A squashed small pastel juice box carton with a bent straw, drawn directly with its dark-brown outline. Not a sticker: no white border or cut-out outline around the object."),
  icon("trash_bone", "A chewed white dog bone."),
  { key: "robber", kind: "sprite", aspect: "1:1", max: 420, prompt: `${STYLE} A sneaky cartoon raccoon burglar standing on two legs, black eye mask, striped shirt, tiptoeing while carrying a big sack with a coin symbol, comedic not scary. ${SPRITE}` },
  { key: "rival_dog", kind: "sprite", aspect: "3:4", max: 480, prompt: `${STYLE} ${DOG} Standing pose with arms crossed. ${SPRITE}` },
);
const RIVAL_SCENES = {
  discount: "holding up a big sign with a huge red 50% and shouting happily",
  trash: "tipping a full black trash bag upside down, rubbish falling out, sneaky look",
  fakeReviews: "typing fast on a smartphone with a sly grin, little one-star icons floating around",
  powerCut: "bending a metal pipe with a big wrench, water dripping, sneaky look",
  karaoke: "singing loudly into a microphone next to a big portable speaker, eyes closed",
};
for (const [id, pose] of Object.entries(RIVAL_SCENES)) {
  ASSETS.push({
    key: `rival_${id}`,
    kind: "sprite",
    aspect: "1:1",
    max: 480,
    ref: "rival_dog",
    prompt: `Edit this image: keep the exact same dog character, same sunglasses, same red apron, same art style, standing upright on two legs with the whole body visible. Change the pose to: ${pose}. Keep the perfectly plain pure white background, no shadow, no ground, no text except the 50% if mentioned.`,
  });
}

// Tier 3 (ASSETS.md section 3): UI that currently shows text only.
const tier = (n, list) => list.map((a) => ({ ...a, tier: n }));
const DRINKS = {
  classic: "creamy light brown milk tea",
  boba: "creamy light brown milk tea with glossy dark tapioca pearls at the bottom",
  jasmine: "clear pale green-yellow jasmine green tea with ice cubes, no milk",
  oolong_milk: "golden beige oolong milk tea",
  green_jelly: "pale mint green milk tea with translucent green coconut jelly cubes",
  oolong_pudding: "golden beige oolong milk tea with soft yellow egg pudding at the bottom",
  black_jelly: "clear amber-red black tea with translucent green coconut jelly cubes, no milk",
};
ASSETS.push(
  ...tier(3, [
    ...Object.entries(DRINKS).map(([id, desc]) => ({
      key: `drink_${id}`,
      kind: "sprite",
      aspect: "3:4",
      max: 320,
      prompt: `${STYLE} A single clear plastic takeaway boba cup sealed with a pastel pink film lid and a thick straw, filled with ${desc}. ${SPRITE}`,
    })),
    icon("upg_fast_tap", "A shiny chrome tea dispenser tap pouring fast, with speed lines and a small lightning bolt."),
    icon("upg_auto_sealer", "A compact pastel pink cup sealing machine with a small golden gear and a sparkle."),
    icon("upg_wide_counter", "A long warm wooden shop counter with a double-headed arrow above it showing it got wider."),
    icon("upg_cozy_plants", "A green potted plant next to a small glowing red paper lantern."),
    icon("upg_bell", "A white lucky cat with one raised paw hanging as a wind chime with a little gold bell."),
    icon("icon_shop", "A small cozy shop storefront with a striped pink awning."),
    icon("icon_recipes", "An open recipe notebook showing a drawing of a boba cup, with a pencil."),
    icon("icon_quests", "A parchment scroll checklist with three tick boxes and a red ribbon."),
    icon("icon_reviews", "A white speech bubble containing three plump yellow stars."),
    icon("icon_rent", "A brass house key with a small paper bill tag tied to it."),
    icon("icon_home", "A tiny cozy cottage house with a warm brown roof, a round window and a little cat-ear shaped chimney."),
    icon("icon_pause", "Two thick rounded vertical caramel-brown bars side by side, like a pause symbol, on a soft cream round badge."),
    icon("icon_close", "A thick rounded X cross made of two caramel-brown bars, on a soft cream round badge."),
    {
      key: "app_icon",
      kind: "bg",
      aspect: "1:1",
      max: 512,
      prompt: `${STYLE} App icon artwork filling the whole square: warm cream background, a cute orange cat face peeking over a big boba milk tea cup with a straw, bold simple shapes readable at very small size. No text, no border.`,
    },
  ]),
);

// Tier 4 (ASSETS.md section 4): new NPCs. Each `character` gets an idle sprite plus ref-edited moods.
function character(key, desc, moods = MOODS) {
  const out = [{ key: `${key}_idle`, kind: "sprite", aspect: "3:4", max: 640, prompt: `${STYLE} ${CAT_BASE} ${desc} Calm content neutral expression, slight smile.` }];
  for (const [mood, moodDesc] of Object.entries(moods)) {
    out.push({
      key: `${key}_${mood}`,
      kind: "sprite",
      aspect: "3:4",
      max: 640,
      ref: `${key}_idle`,
      prompt: `Edit this image: keep the exact same cat character, same fur pattern, same outfit and accessories, same art style, same framing and size, still standing upright on two legs with the whole body visible. Change only the expression and pose to: ${moodDesc}. Keep the perfectly plain pure white background, no shadow, no ground.`,
    });
  }
  return out;
}
const npc = (key, desc) => ({ key, kind: "sprite", aspect: "3:4", max: 640, prompt: `${STYLE} ${CAT_BASE} ${desc}` });
const RIDER = (fur, color) =>
  `${fur} delivery rider cat wearing a ${color} rider jacket and a matching helmet, an insulated ${color} delivery box bag on the back, holding a smartphone. Plain clothes with no logo and no text.`;
ASSETS.push(
  ...tier(4, [
    npc("npc_police", "Friendly chubby grey cat police officer in a Vietnamese-style olive green police uniform with a peaked cap, holding a clipboard, stern but kind smile."),
    icon("icon_tax", "A paper tax bill envelope with a red official stamp and a gold coin."),
    ...character("shipper_grab", RIDER("Black and white tuxedo", "bright green")),
    ...character("shipper_bee", RIDER("Chubby cream-colored", "bright yellow")),
    ...character("shipper_food", RIDER("Brown tabby", "bright orange")),
    icon("icon_delivery", "A small scooter with an insulated delivery box on the back."),
    ...character("cat_granny", "Elderly grey-and-white cat grandma with round spectacles, a lilac Vietnamese ao ba ba top, a knitted shawl and a little wooden walking cane, gentle kind face."),
    ...character("cat_tiktoker", "Trendy young Siamese cat influencer in a pastel hoodie, holding a smartphone on a selfie stick with a small ring light, expressive."),
    npc("npc_lottery", "Skinny cheerful ginger cat street vendor wearing a conical non la hat and a small waist bag, holding a fan of colorful lottery tickets, friendly grin."),
    icon("icon_lottery", "A fan of three colorful lottery tickets decorated with dots and stars, no readable text."),
    ...character("npc_stray", "Small skinny scruffy kitten, slightly dusty light grey fur, a little torn red scarf, big hopeful shiny eyes looking up longingly.", { happy: MOODS.happy }),
    npc("npc_supplier", "Sturdy black cat wholesale supplier wearing a denim apron and a cap, pushing a small hand truck stacked with ingredient boxes, salesman grin."),
  ]),
);
// Tier 2 (ASSETS.md section 2): spots already wired in the UI.
const TIER2 = /^(icon_discount|icon_wrench|icon_bankrupt|trash_.*|robber|rival_.*)$/;
for (const a of ASSETS) a.tier ??= TIER2.test(a.key) ? 2 : 1;

function refDataUrl(asset) {
  if (!asset.ref) return null;
  const b64 = fs.readFileSync(path.join(RAW_DIR, `${asset.ref}.png`)).toString("base64");
  return `data:image/png;base64,${b64}`;
}

async function callProxy(asset) {
  const ref = refDataUrl(asset);
  const content = ref
    ? [
        { type: "text", text: asset.prompt },
        { type: "image_url", image_url: { url: ref } },
      ]
    : asset.prompt;
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content }],
      image_config: { aspect_ratio: asset.aspect },
    }),
  });
  const json = await res.json();
  const url = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`No image: ${JSON.stringify(json).slice(0, 200)}`);
  return Buffer.from(url.split(",")[1], "base64");
}

async function callFal(asset) {
  const ref = refDataUrl(asset);
  const endpoint = ref ? `${FAL_MODEL}/edit` : FAL_MODEL;
  const body = {
    prompt: asset.prompt,
    aspect_ratio: asset.aspect,
    output_format: "png",
    num_images: 1,
    resolution: "1K",
    sync_mode: true,
    ...(ref ? { image_urls: [ref] } : {}),
  };
  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const url = json?.images?.[0]?.url;
  if (!url) throw new Error(`No image (fal ${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
  if (url.startsWith("data:")) return Buffer.from(url.split(",")[1], "base64");
  const img = await fetch(url);
  return Buffer.from(await img.arrayBuffer());
}

const ATTEMPTS = 3;
const QUOTA_RE = /429|exhausted|quota|auth_unavailable|RESOURCE_EXHAUSTED/i;
/** Set once an asset fails every attempt: the run stops instead of burning calls on a dead quota. */
let outOfQuota = null;

async function callModel(asset) {
  const providers = PROVIDER === "fal" ? ["fal"] : FALLBACK_TO_FAL ? ["proxy", "fal"] : ["proxy"];
  let lastErr;
  for (const provider of providers) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      if (outOfQuota) throw outOfQuota;
      try {
        return provider === "fal" ? await callFal(asset) : await callProxy(asset);
      } catch (err) {
        lastErr = err;
        console.warn(`  [${asset.key}] ${provider} attempt ${attempt}/${ATTEMPTS} failed: ${err.message.slice(0, 160)}`);
        if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 8000 * attempt));
      }
    }
  }
  const reset = String(lastErr?.message).match(/reset after ([0-9hms.]+)/)?.[1];
  outOfQuota = new Error(`${QUOTA_RE.test(String(lastErr?.message)) ? "Out of quota" : "Provider keeps failing"}${reset ? ` (reset after ${reset})` : ""}`);
  throw lastErr;
}

// Flood-fills light, unsaturated pixels connected to the image border, then unmixes white from the edge.
async function removeBackground(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const N = w * h;
  const lum = (i) => (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114);
  const chroma = (i) => Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) - Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  // Background, white sticker borders and their faint grey drop lines are all light and unsaturated.
  const passable = (i) => lum(i) > 175 && chroma(i) < 28;
  const bg = new Uint8Array(N);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !passable(i)) continue;
    bg[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }
  const touches = (i, m) => {
    const x = i % w, y = (i / w) | 0;
    return (x > 0 && m[i - 1]) || (x < w - 1 && m[i + 1]) || (y > 0 && m[i - w]) || (y < h - 1 && m[i + w]);
  };
  // Pixels reached by the flood plus a 2px ring into the outline get "white to alpha" unmixing:
  // a pixel that is a blend of white and colour C keeps C with alpha = blend weight. Glows stay soft,
  // anti-aliased outline edges lose their white tint.
  const edge = new Uint8Array(bg);
  for (let pass = 0; pass < 2; pass++) {
    const add = [];
    for (let i = 0; i < N; i++) if (!edge[i] && touches(i, edge)) add.push(i);
    for (const i of add) edge[i] = 1;
  }
  for (let i = 0; i < N; i++) {
    if (!edge[i]) continue;
    const o = i * 4;
    const a = Math.max(255 - data[o], 255 - data[o + 1], 255 - data[o + 2]) / 255;
    const alpha = a < 0.06 ? 0 : a;
    if (alpha > 0) for (let c = 0; c < 3; c++) data[o + c] = Math.round(Math.max(0, Math.min(255, (data[o + c] - 255 * (1 - alpha)) / alpha)));
    data[o + 3] = Math.round(alpha * 255);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

async function processAsset(asset, force, reprocess = false) {
  const rawFile = path.join(RAW_DIR, `${asset.key}.png`);
  const outFile = path.join(OUT_DIR, `${asset.key}.webp`);
  if (reprocess) {
    if (!fs.existsSync(rawFile)) return "skip";
  } else if (!force && fs.existsSync(outFile)) return "skip";
  if (!reprocess && (force || !fs.existsSync(rawFile))) {
    const img = await callModel(asset);
    await sharp(img).png().toFile(rawFile);
  }
  let pipeline;
  if (asset.kind === "sprite") {
    const cut = await removeBackground(fs.readFileSync(rawFile));
    pipeline = sharp(await sharp(cut).trim({ threshold: 1 }).toBuffer());
  } else {
    pipeline = sharp(rawFile);
  }
  await pipeline
    .resize({ width: asset.max, height: asset.max, fit: "inside", withoutEnlargement: true })
    .webp({ quality: asset.kind === "bg" ? 82 : 88, alphaQuality: 90 })
    .toFile(outFile);
  return "ok";
}

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.filter((a) => !a.startsWith("--"));
  const list = only.length ? ASSETS.filter((a) => only.includes(a.key)) : ASSETS;
  if (args.includes("--reprocess")) {
    // Rebuild webp files from art-src/ without calling the model (e.g. after changing removeBackground).
    for (const a of list) if ((await processAsset(a, false, true)) === "ok") console.log(`✓ ${a.key}`);
    return;
  }
  if (args.includes("--list")) {
    for (const a of list) if (!fs.existsSync(path.join(OUT_DIR, `${a.key}.webp`))) console.log(`tier${a.tier} ${a.key}`);
    return;
  }

  // Tier by tier (ASSETS.md order); inside a tier, base images first so that edits can reference them.
  const groups = [];
  for (const t of [...new Set(list.map((a) => a.tier))].sort()) {
    groups.push(list.filter((a) => a.tier === t && !a.ref), list.filter((a) => a.tier === t && a.ref));
  }
  const failed = [];
  let made = 0;
  for (const group of groups) {
    const queue = [...group];
    const workers = Array.from({ length: 3 }, async () => {
      while (queue.length && !outOfQuota) {
        const a = queue.shift();
        if (a.ref && !fs.existsSync(path.join(RAW_DIR, `${a.ref}.png`))) {
          console.log(`… ${a.key}: waiting for ${a.ref}`);
          continue;
        }
        try {
          const r = await processAsset(a, force);
          if (r === "ok") made++;
          if (r === "ok" || only.length) console.log(`${r === "skip" ? "-" : "✓"} ${a.key}`);
        } catch (e) {
          failed.push(a.key);
          console.error(`✗ ${a.key}: ${e.message.slice(0, 160)}`);
        }
      }
    });
    await Promise.all(workers);
    if (outOfQuota) break;
  }
  console.log(`\nGenerated ${made} new image(s).${outOfQuota ? ` Stopped: ${outOfQuota.message}.` : ""}`);
  fs.writeFileSync(
    path.join(ROOT, "src", "presentation", "game", "assetManifest.json"),
    JSON.stringify(
      ASSETS.map((a) => a.key).filter((k) => fs.existsSync(path.join(OUT_DIR, `${k}.webp`))),
      null,
      2,
    ),
  );
  if (failed.length) {
    console.error(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main();
