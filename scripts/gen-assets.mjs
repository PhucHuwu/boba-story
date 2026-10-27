// Generates game art via the AI proxy, removes the flat background and writes optimized WebP files.
// Usage: node scripts/gen-assets.mjs [--force] [key ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { assetPath } from "./asset-paths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW_DIR = path.join(ROOT, "art-src");
const OUT_DIR = path.join(ROOT, "public", "assets");
const rawPath = (key) => path.join(RAW_DIR, `${assetPath(key)}.png`);
const outPath = (key) => path.join(OUT_DIR, `${assetPath(key)}.webp`);

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

/** @type {{key:string,prompt:string,aspect:string,kind:'bg'|'sprite'|'glass',max:number,ref?:string,cover?:[number,number],holes?:boolean}[]} */
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
// Tier 5 (ASSETS.md section 5): brewing art. "glass" assets are unmixed from white everywhere (not only from the
// border), so a clear cup or ice cube keeps its outline and tint while its body becomes see-through.
const BREW = "Drawn straight-on from the front (not three-quarter), centered, isolated on a perfectly plain pure white background. No shadow, no table, no text.";
const piece = (key, desc, max = 96, kind = "sprite") => ({ key, kind, aspect: "1:1", max, prompt: `${STYLE} ${desc} ${BREW}` });
ASSETS.push(
  ...tier(5, [
    piece(
      "cup_glass",
      "An empty clear transparent plastic boba tea cup, tall and tapered (wider at the top), open top rim drawn as a thin ellipse, no lid, no straw, no drink inside. Dark-brown outline, very faint light-blue tint on the plastic, two soft pale-blue vertical highlight streaks on the left side.",
      420,
      "glass",
    ),
    piece("liquid_surface", "The flat top surface of a drink seen from slightly above: a wide thin horizontal ellipse filled with very pale cream foam, a few tiny round bubbles near the edge, thin dark-brown outline.", 300),
    piece("liquid_swirl", "A soft creamy white milk swirl ribbon curling like a spiral cloud, as when milk is poured into tea, thin dark-brown outline.", 220),
    piece("liquid_syrup", "A small glossy amber brown sugar syrup blob that spreads and swirls, like syrup sinking in a drink, thin dark-brown outline.", 200),
    piece("piece_boba", "One single glossy dark brown tapioca pearl ball with a small white shine highlight.", 64),
    piece("piece_jelly", "One single translucent pale green coconut jelly cube with soft rounded edges and a white shine.", 72),
    piece("piece_pudding", "One single soft wobbly yellow egg pudding chunk with a caramel brown top.", 80),
    piece("piece_ice", "One single clear ice cube with rounded edges, light-blue outline and a white shine highlight.", 80),
    piece("cup_lid", "A sealed boba cup film lid seen from the front and slightly above: a thin flat pastel pink ellipse printed with a small cute white cat paw print, thin dark-brown outline.", 300),
    piece("cup_straw", "One thick straight boba straw, pastel red with a white stripe, cut at an angle at the top, standing vertical.", 240),
    piece("cup_coaster", "A round woven bamboo coaster seen from slightly above as a wide flat ellipse.", 300),
    // Stage 2: stations while in use (edits of the existing sprites, so the drawing stays identical).
    ...["tea_black", "tea_green", "tea_oolong"].map((t) => ({
      key: `${t}_pour`,
      kind: "sprite",
      aspect: "1:1",
      max: 360,
      ref: t,
      prompt: "Edit this image: keep the exact same tea dispenser, same colors, same art style, same framing and size. Change only the tap: its lever is turned open and a short stream of tea flows down from the spout. Plain white background.",
    })),
    { key: "milk_pour", kind: "sprite", aspect: "1:1", max: 340, ref: "milk", prompt: "Edit this image: keep the exact same milk jug, same pattern, same art style and size. Tilt the jug about 40 degrees to the left as if pouring, with a short stream of milk flowing out of the spout. Plain white background." },
    { key: "sugar_press", kind: "sprite", aspect: "1:1", max: 320, ref: "sugar", prompt: "Edit this image: keep the exact same syrup pump bottle, same colors, same art style and size. The pump head is pressed all the way down and a drop of syrup comes out of the nozzle. Plain white background." },
    { key: "ice_scoop", kind: "sprite", aspect: "1:1", max: 360, ref: "ice", prompt: "Edit this image: keep the exact same ice bin, same art style and size. The metal scoop is lifted up above the bin, heaped full of ice cubes. Plain white background." },
    { key: "sealer_press", kind: "sprite", aspect: "1:1", max: 360, ref: "sealer", prompt: "Edit this image: keep the exact same pink cup sealing machine, same art style and size. Its lever handle is pulled all the way down, a small warm glow at the sealing plate and a tiny puff of steam. Plain white background." },
    ...[["boba", "glossy dark brown tapioca pearls"], ["jelly", "translucent pale green coconut jelly cubes"], ["pudding", "soft yellow egg pudding chunks"]].map(([t, d]) => piece(`scoop_${t}`, `A small round metal ladle spoon with a short wooden handle, heaped full of ${d}, tilted slightly.`, 180)),
    // Stage 3: pour and feedback effects.
    piece("pour_stream", "A straight vertical stream of pale cream liquid pouring down, smooth ribbon with a few highlight lines, thin dark-brown outline, tall and narrow.", 260),
    piece("fx_splash", "A small crown-shaped splash of pale cream liquid with a few flying droplets, thin dark-brown outline.", 160),
    piece("fx_spill", "A flat spilled puddle of pale cream liquid seen from slightly above, irregular rounded blob shape with a couple of droplets, thin dark-brown outline.", 260),
    piece("fx_sparkle", "A cluster of three cute golden four-pointed sparkle stars of different sizes.", 160),
    { ...piece("gauge_tube", "A tall narrow empty clear glass measuring tube with rounded ends and small dark-brown tick marks along the side, standing vertical, no liquid.", 360), aspect: "9:16" },
    // Stage 4: shake step.
    piece("shaker", "A cute stainless steel cocktail shaker for tea with a pastel pink cap and a little cat-ear shaped top, standing upright.", 300),
    {
      key: "shaker_shake",
      kind: "sprite",
      aspect: "1:1",
      max: 300,
      ref: "shaker",
      prompt: "Edit this image: keep the exact same cocktail shaker, same colors, same art style and size. Tilt it about 25 degrees as if being shaken hard, with a few short curved motion lines and two tiny droplets around it. Plain white background.",
    },
    // Stage 5: frames for in-scene UI (drawn empty so they can be stretched as nine-slice).
    { key: "ui_card", kind: "sprite", aspect: "4:3", max: 360, prompt: `${STYLE} An empty blank order note card: a cream paper rectangle with rounded corners, thick dark-brown outline, a subtle paper texture, a small pointed tail at the bottom center like a speech bubble. Completely blank, no text, no icons. Flat front view, isolated on a perfectly plain pure white background. No shadow.` },
    { key: "ui_bubble", kind: "sprite", aspect: "16:9", max: 360, prompt: `${STYLE} An empty blank speech bubble: wide white rounded rectangle with a thick dark-brown outline and a small tail at the bottom center. Completely blank, no text. Flat front view, isolated on a perfectly plain pure white background. No shadow.` },
    { key: "ui_ticket", kind: "sprite", aspect: "21:9", max: 720, prompt: `${STYLE} An empty blank wide order ticket: a long cream paper strip with rounded corners, thick dark-brown outline, a small red-and-white washi tape piece at the top left corner. Completely blank, no text. Flat front view, isolated on a perfectly plain pure white background. No shadow.` },
  ]),
);

// Tier 6 (ASSETS.md section 6): landing page art. Full-bleed illustrations, so no background removal.
const SHOP_CATS =
  "two-legged anthropomorphic cat customers standing upright like people: an orange tabby student with a backpack, a grey tabby office worker with glasses, a calico in a pink cardigan and beret, an elegant white Persian with a pearl necklace, a grey cat grandma with spectacles and a cane, a Siamese influencer holding a phone";
ASSETS.push(
  ...tier(6, [
    {
      key: "landing_hero_wide",
      kind: "bg",
      aspect: "16:9",
      max: 1920,
      prompt: `${STYLE} Wide cinematic key art illustration for a cozy boba tea shop game. Seen from behind the wooden shop counter: a cheerful little Vietnamese boba milk tea shop at golden afternoon, warm string lights, hanging plants, pastel walls, a big window with a quiet leafy street outside (no people, no humans anywhere). On the counter in the foreground sit several colorful boba milk tea cups with tapioca pearls and straws. On the customer side, a happy queue of ${SHOP_CATS}. Keep the left third of the image calmer and softer (wall and window) so a title can be placed there. No readable text, no letters, no logos.`,
    },
    {
      key: "landing_hero_tall",
      kind: "bg",
      aspect: "9:16",
      max: 1376,
      prompt: `${STYLE} Vertical key art illustration for a cozy boba tea shop game, phone wallpaper layout. A cheerful little Vietnamese boba milk tea shop with warm string lights, hanging plants and pastel walls, seen from behind the wooden counter. In the lower half, three happy two-legged anthropomorphic cats standing upright like people (an orange tabby student with a backpack, a calico in a pink cardigan and beret, a Siamese holding a phone) lean on the counter next to colorful boba milk tea cups. The top third is calm soft wall and string lights with plenty of empty space for a title. No readable text, no letters, no logos.`,
    },
    {
      key: "landing_og",
      kind: "bg",
      aspect: "16:9",
      max: 1200,
      cover: [1200, 630],
      prompt: `${STYLE} Social media banner illustration for a cozy boba tea shop game. Centered composition: a cute orange tabby cat barista in a cream apron standing upright on two legs behind a wooden counter, proudly holding up a big boba milk tea cup with a straw, surrounded by a few colorful drink cups, warm string lights and hanging plants behind, soft warm pastel background. Keep all important content inside the middle area, away from the top and bottom edges. No readable text, no letters, no logos.`,
    },
    {
      key: "landing_group",
      // Kept on its white background: the cut-out ate the white Persian's fur. The page blends it with multiply.
      kind: "bg",
      aspect: "16:9",
      max: 960,
      prompt: `${STYLE} A friendly group portrait of ${SHOP_CATS}, all standing side by side and waving happily, each holding a boba milk tea cup, whole bodies including feet visible. Isolated on a perfectly plain pure white background, no shadow, no ground, no text.`,
    },
  ]),
);

// Tier 7 (ASSETS.md section 7): shop decor. Drawn into the room at fixed spots and reused as shop icons.
const DECOR_STYLE = "Matches a cozy pastel boba tea shop interior. Front view with very slight top-down angle.";
ASSETS.push(
  ...tier(7, [
    { key: "decor_lanterns", kind: "sprite", aspect: "16:9", max: 720, prompt: `${STYLE} ${DECOR_STYLE} A horizontal garland of five small round Vietnamese paper lanterns in pastel pink, peach, cream and mint hanging from a thin string, glowing softly warm. ${SPRITE}` },
    { key: "decor_rug", kind: "sprite", aspect: "16:9", max: 720, prompt: `${STYLE} A flat oval floor rug shaped like a cute sleeping cat face with ears, soft cream and peach colors with a pink border, seen from above at a low angle like it lies on a wooden floor (wide and squashed vertically). ${SPRITE}` },
    { key: "decor_monstera", kind: "sprite", holes: true, aspect: "3:4", max: 640, prompt: `${STYLE} ${DECOR_STYLE} A big leafy monstera plant with large split green leaves in a round terracotta pot, tall floor plant. ${SPRITE}` },
    { key: "decor_painting", kind: "sprite", aspect: "3:4", max: 512, prompt: `${STYLE} ${DECOR_STYLE} A small framed painting hung on a wall: a naive childlike painting of a little boba tea shop with a cat and a milk tea cup, in a warm wooden frame. No readable text. ${SPRITE}` },
    { key: "decor_plushies", kind: "sprite", aspect: "1:1", max: 640, prompt: `${STYLE} ${DECOR_STYLE} A small wooden two-tier shelf full of cute plush toys: a cat plush, a boba cup plush, a bunny plush and a bear plush. ${SPRITE}` },
    { key: "decor_chalkboard", kind: "sprite", aspect: "3:4", max: 512, prompt: `${STYLE} ${DECOR_STYLE} A small A-frame chalkboard sidewalk sign with a wooden frame, hand drawn chalk doodles of a boba cup, a cat face and little stars, no letters, no words, no readable text. ${SPRITE}` },
  ]),
);

// Tier 8 (ASSETS.md section 8): head accessories worn by everyday customers (0-1 each, placed at a head anchor).
const ACC = "Front view, flat and symmetrical, as worn by a cartoon cat seen from the front. Single item only, no cat, no head, no mannequin.";
const acc = (key, desc, max = 320) => ({ key, kind: "sprite", aspect: "1:1", max, prompt: `${STYLE} ${ACC} ${desc} ${SPRITE}` });
ASSETS.push(
  ...tier(8, [
    acc("acc_beanie", "A small pastel mint knitted beanie hat with a cream pom-pom, short and round so it sits between two cat ears."),
    acc("acc_bow", "A big cute pink satin hair ribbon bow."),
    acc("acc_flower", "A hair clip made of one big pastel yellow flower with two small green leaves."),
    acc("acc_cap", "A small red baseball cap seen from the front, short brim facing the viewer, no logo."),
    { ...acc("acc_wreath", "A small flower crown wreath of tiny pastel pink, white and peach flowers with little green leaves, seen from the front, short and wide like it rests on top of a head."), holes: true },
    acc("acc_star", "A hair clip shaped like one chunky pastel yellow star with a tiny sparkle, cute and simple."),
  ]),
);

// Tier 9 (ASSETS.md section 9): look variants of everyday customers. Ref-edited from the base idle so the pose and
// framing match; the moods are then edited from the variant idle.
const VARIANTS = {
  student: [
    "black and white tuxedo fur, a sunny yellow hoodie, a red backpack and white sneakers",
    "cream and light ginger fur, a lilac knitted sweater, a green backpack and pink rain boots",
  ],
  office: [
    "solid black fur with green eyes, a light blue shirt, a red tie, beige trousers and square glasses, still holding a smartphone",
    "ginger tabby fur, a cream blouse under a brown blazer, a work badge on a lanyard, dark trousers, still holding a smartphone, no glasses",
  ],
  picky: [
    "fluffy silver-grey Persian fur, a mint green coat, a pearl necklace and a tiny handbag",
    "fluffy cream colourpoint fur with blue eyes, a rose pink coat, a gold necklace and a tiny handbag",
  ],
};
for (const [id, list] of Object.entries(VARIANTS)) {
  list.forEach((desc, n) => {
    const key = `cat_${id}_v${n + 1}`;
    ASSETS.push({
      key: `${key}_idle`,
      kind: "sprite",
      aspect: "3:4",
      max: 640,
      tier: 9,
      ref: `cat_${id}_idle`,
      prompt: `Edit this image: keep the exact same pose, body shape, proportions, framing, size and art style, still standing upright on two legs with the whole body visible and the same calm expression. Change only the fur colour and the outfit to: ${desc}. Keep the perfectly plain pure white background, no shadow, no ground.`,
    });
    for (const [mood, moodDesc] of Object.entries(MOODS)) {
      ASSETS.push({
        key: `${key}_${mood}`,
        kind: "sprite",
        aspect: "3:4",
        max: 640,
        tier: 9,
        ref: `${key}_idle`,
        prompt: `Edit this image: keep the exact same cat character, same fur pattern, same outfit and accessories, same art style, same framing and size, still standing upright on two legs with the whole body visible. Change only the expression and pose to: ${moodDesc}. Keep the perfectly plain pure white background, no shadow, no ground.`,
      });
    }
  });
}

// Tier 10 (ASSETS.md section 10): blink frames, edited from each idle so only the eyelids change.
const BLINK_BASES = ["cat_regular", "cat_student", "cat_office", "cat_picky", "cat_granny", "cat_tiktoker"];
for (const base of [...BLINK_BASES, ...Object.entries(VARIANTS).flatMap(([id, l]) => l.map((_, n) => `cat_${id}_v${n + 1}`))]) {
  ASSETS.push({
    key: `${base}_blink`,
    kind: "sprite",
    aspect: "3:4",
    max: 640,
    tier: 10,
    ref: `${base}_idle`,
    prompt: "Edit this image: keep absolutely everything identical (same character, pose, outfit, colours, framing, size, art style, mouth and whiskers). Change only the eyes: both eyes gently closed in a relaxed blink, drawn as soft curved lines. Keep the perfectly plain pure white background, no shadow, no ground.",
  });
}

// Tier 2 (ASSETS.md section 2): spots already wired in the UI.
const TIER2 = /^(icon_discount|icon_wrench|icon_bankrupt|trash_.*|robber|rival_.*)$/;
for (const a of ASSETS) a.tier ??= TIER2.test(a.key) ? 2 : 1;

function refDataUrl(asset) {
  if (!asset.ref) return null;
  const b64 = fs.readFileSync(rawPath(asset.ref)).toString("base64");
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
// `holes`: also clears enclosed near-white pockets (gaps between leaves) of at least `minHole` pixels.
// Only for art without white parts of its own, since a white patch would be punched out too.
async function removeBackground(buf, holes = false) {
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
  if (holes) {
    const strict = (i) => lum(i) > 232 && chroma(i) < 14;
    const minHole = Math.max(12, Math.round(N * 0.00002));
    const seen = new Uint8Array(N);
    for (let start = 0; start < N; start++) {
      if (bg[start] || seen[start] || !strict(start)) continue;
      const comp = [];
      const st = [start];
      seen[start] = 1;
      while (st.length) {
        const i = st.pop();
        comp.push(i);
        const x = i % w, y = (i / w) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j >= 0 && !seen[j] && !bg[j] && strict(j)) {
            seen[j] = 1;
            st.push(j);
          }
        }
      }
      if (comp.length >= minHole) for (const i of comp) bg[i] = 1;
    }
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

/** White → alpha over the whole image: a pixel blended from white and colour C keeps C with alpha = blend weight. */
async function unmixWhite(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let o = 0; o < data.length; o += 4) {
    const a = Math.max(255 - data[o], 255 - data[o + 1], 255 - data[o + 2]) / 255;
    const alpha = a < 0.04 ? 0 : a;
    if (alpha > 0) for (let c = 0; c < 3; c++) data[o + c] = Math.round(Math.max(0, Math.min(255, (data[o + c] - 255 * (1 - alpha)) / alpha)));
    data[o + 3] = Math.round(alpha * 255);
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function processAsset(asset, force, reprocess = false) {
  const rawFile = rawPath(asset.key);
  const outFile = outPath(asset.key);
  fs.mkdirSync(path.dirname(rawFile), { recursive: true });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (reprocess) {
    if (!fs.existsSync(rawFile)) return "skip";
  } else if (!force && fs.existsSync(outFile)) return "skip";
  if (!reprocess && (force || !fs.existsSync(rawFile))) {
    const img = await callModel(asset);
    await sharp(img).png().toFile(rawFile);
  }
  let pipeline;
  if (asset.kind === "glass") {
    pipeline = sharp(await sharp(await unmixWhite(fs.readFileSync(rawFile))).trim({ threshold: 1 }).toBuffer());
  } else if (asset.kind === "sprite") {
    const cut = await removeBackground(fs.readFileSync(rawFile), asset.holes);
    pipeline = sharp(await sharp(cut).trim({ threshold: 1 }).toBuffer());
  } else {
    pipeline = sharp(rawFile);
  }
  await pipeline
    .resize(
      asset.cover
        ? { width: asset.cover[0], height: asset.cover[1], fit: "cover" }
        : { width: asset.max, height: asset.max, fit: "inside", withoutEnlargement: true },
    )
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
    for (const a of list) if (!fs.existsSync(outPath(a.key))) console.log(`tier${a.tier} ${a.key}`);
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
        if (a.ref && !fs.existsSync(rawPath(a.ref))) {
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
      Object.fromEntries(ASSETS.map((a) => a.key).filter((k) => fs.existsSync(outPath(k))).map((k) => [k, `${assetPath(k)}.webp`])),
      null,
      2,
    ) + "\n",
  );
  if (failed.length) {
    console.error(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main();
