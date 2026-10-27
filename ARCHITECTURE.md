# Architecture

Boba Story follows Clean Architecture. **Source dependencies point inward only**; inner layers know nothing
about Phaser, React, Next.js or Redis. The rule is enforced by `no-restricted-imports` in `eslint.config.mjs`
(`npm run lint` fails on a violating import).

```
src/
  domain/          Pure game rules: catalog, cup mixing, quality scoring, customers, economy, save schema.
    dayPlan.ts       Weather, daily goal, rival attack and morning visitor, rolled once per day.
    night.ts         Rent, bank, robbery, weekly tax, bankruptcy and loans.
    delivery.ts      Delivery-app shippers (multi-cup orders, commission).
    guests.ts        Special guests during the day (granny, TikToker).
    visitors.ts      Morning visitors on the prep screen (lottery seller, supplier, stray kitten).
    decor.ts         Shop decor catalog, unlocks and summed bonuses (tips, patience, arrivals).
    customers.ts     Customer lifecycle, patience, order rules and `rollLook` (look variant + accessory).
    community.ts     Feedback, anonymous day telemetry and menu announcement: shapes + validation.
  application/     Use cases + ports. Depends on domain only.
    ports.ts         Interfaces the outside world must implement (saves, cloud, AI text, cache, rate limit…).
    game/            GameController (app facade, observable), ShopSession (day simulation), tutorial.
    cloud/           CloudSaveService (server use case).
    dialogue/        DialogueService (server use case: AI line → cache → fallback).
    community/       CommunityService (public: feedback, telemetry, announcement) and AdminService.
  infrastructure/  Adapters implementing ports.
    browser/         localStorage saves, HTTP gateways to /api/*.
    server/          Upstash Redis store/cache/limiter, OpenAI-compatible text generator.
  presentation/    Delivery to the player.
    game/            Phaser "humble view": ShopScene renders session state and forwards input as commands.
                     layout.ts holds per-form-factor positions (phone / tabletPortrait / landscape).
                     keymap.ts: keyboard shortcuts. decorSpots.ts: decor positions in bg_room pixels.
                     catLooks.ts: per-mood head poses and accessory fits (fractions of sprite height).
                     assetPlan.ts: which art preloads and which streams in after the shop opens.
    ui/              React overlays (HUD, menus, modals) reading GameController via useGame().
    landing/         Public home page at `/` (hero, cat cast, latest announcement, feedback form, FAQ).
                     Server-rendered markup with small client islands (play button, mood toggle, form).
  composition/     Composition roots — the only place concrete adapters are chosen.
    client.ts        getGame(): GameController wired with browser adapters; landing helpers
                     (localSaveSummary(), landingCommunity) so the home page needs no game controller.
    server.ts        serverServices(): server use cases wired with Upstash + AI adapters; isAdminRequest().
    http.ts          Route helpers: small JSON body parsing, ServiceResult → Response, admin-key guard.
  app/             Next.js App Router: `/` landing page, `/play` game, OG/Twitter images, thin route handlers (`/api/save`, `/api/dialogue`, `/api/health`,
                   `/api/feedback`, `/api/telemetry`, `/api/announcement`, `/api/admin/*`).
admin/             Separate Next.js app (own package.json, own Vercel project `boba-story-admin`).
                   Not part of the layers above: it only calls the game's `/api/admin/*` over HTTP.
```

| Layer | May import |
| --- | --- |
| `domain` | nothing outside itself |
| `application` | `domain` |
| `infrastructure` | `application` (ports), `domain`, external SDKs |
| `presentation/game` | `application`, `domain`, Phaser |
| `presentation/ui`, `presentation/landing`, `composition`, `app` | anything inward |

## Runtime flow

1. `app/page.tsx` is the landing page; its "Chơi ngay" / "Chơi tiếp · Ngày N" button reads the local save
   and links to `/play`. Both pages share the same origin, so saves in localStorage carry over.
   `app/play/page.tsx` renders `GameApp` (client). It picks a layout from the viewport (`pickLayoutKind`), sizes
   the stage box to that layout's aspect ratio and mounts Phaser (`Scale.FIT`) plus React overlays in the
   same box, so overlay `%` positions line up with canvas coordinates. Rotating swaps layouts and remounts
   the scene; the session lives in `GameController`, so the day continues (auto-paused).
2. `ShopScene.update` ticks `ShopSession` only while `GameController.running`. The session emits
   `ShopEvent`s (arrived, served, cup…) which the scene turns into animation/sound; React re-renders through
   `useSyncExternalStore` on controller changes.
3. Player input → session commands (`takeCup`, `startPour`, `deliver`…). All rules (quality, payment,
   reputation, quests) are evaluated in domain/application code and are unit-tested without a browser.
4. Server routes call `serverServices()`; missing env vars degrade gracefully (`/api/health` reports status).
5. Admin: the admin app's server (never the browser) calls `/api/admin/*` with `Authorization: Bearer
   ADMIN_API_KEY`. Without that env var every admin route answers 401. The admin app has its own login
   (`ADMIN_USERNAME` + scrypt `ADMIN_PASSWORD_HASH`, HMAC-signed httpOnly cookie, 7 days); login attempts are
   rate-limited through the game's Redis (`/api/admin/login-attempt`).

### Redis keys

| Key | Content |
| --- | --- |
| `save:<code>` | Cloud save (TTL 180 days) |
| `fb:seq`, `fb:<id>`, `fb:index` (zset) | Feedback entries, newest 2000 kept |
| `tm:day:<n>` (hash), `tm:days` (zset), `tm:date:<YYYY-MM-DD>` | Telemetry sums per game day, reports per date (TTL 40 days) |
| `announcement` | Current menu announcement |
| `rl:*` | Rate-limit windows |

## Adding things

- **New ingredient / recipe** → `domain/catalog.ts` (+ station in each layout in `presentation/game/layout.ts`).
- **New storage or AI provider** → implement the port in `infrastructure/`, wire it in `composition/`.
- **New in-shop customer type** → `ArchetypeId` in `domain/types.ts` (+ `ARCHS` in `saveSchema.ts`), `ARCHETYPES` and
  lines in `domain/catalog.ts`, order rules in `createOrder`, spawn rule in `ShopSession.spawn`, art `cat_<id>_<mood>`.
- **New morning visitor** → `MorningVisitor` + `pickVisitor` in `domain/visitors.ts`, an action on `GameController`,
  and a branch in `VisitorCard` (`presentation/ui/features.tsx`).
- **New art** → prompt in `scripts/gen-assets.mjs`, a `- [ ]` line in `ASSETS.md`, then `npm run gen:assets -- <key>`
  (the file lands in the folder chosen by `scripts/asset-paths.mjs`; the manifest `presentation/game/assetManifest.json`,
  key → path, is regenerated; code refers to art by key only; `Icon` renders nothing for missing art).
- **New decor item** → `DecorId` + entry in `DECOR` (`domain/decor.ts`), a spot in `presentation/game/decorSpots.ts`
  (bg_room pixels; rows ~490–745 are clear on every layout), art `decor_<name>`.
- **New accessory** → add the key to `ACCESSORIES` (`domain/customers.ts`) and a fit in `ACCESSORY_FIT`
  (`presentation/game/catLooks.ts`); only crown/side anchors, nothing over the face.
- **New look variant** → raise `LOOK_VARIANTS` and add a `VARIANTS` description in `scripts/gen-assets.mjs`
  (ref-edited from the base idle, so the head poses still match).
- **New art key** → loads before the shop opens unless it matches a `DEFERRED` pattern in
  `presentation/game/assetPlan.ts`; deferred art must be looked up with `textures.exists` (or only used by React UI).
- **New screen size** → add a `Layout` to `LAYOUTS` and extend `pickLayoutKind`; `layout.test.ts` checks bounds.
