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
  application/     Use cases + ports. Depends on domain only.
    ports.ts         Interfaces the outside world must implement (saves, cloud, AI text, cache, rate limit…).
    game/            GameController (app facade, observable), ShopSession (day simulation), tutorial.
    cloud/           CloudSaveService (server use case).
    dialogue/        DialogueService (server use case: AI line → cache → fallback).
  infrastructure/  Adapters implementing ports.
    browser/         localStorage saves, HTTP gateways to /api/*.
    server/          Upstash Redis store/cache/limiter, OpenAI-compatible text generator.
  presentation/    Delivery to the player.
    game/            Phaser "humble view": ShopScene renders session state and forwards input as commands.
                     layout.ts holds per-form-factor positions (phone / tabletPortrait / landscape).
    ui/              React overlays (HUD, menus, modals) reading GameController via useGame().
  composition/     Composition roots — the only place concrete adapters are chosen.
    client.ts        getGame(): GameController wired with browser adapters.
    server.ts        serverServices(): server use cases wired with Upstash + AI adapters.
  app/             Next.js App Router: page + thin route handlers (`/api/save`, `/api/dialogue`, `/api/health`).
```

| Layer | May import |
| --- | --- |
| `domain` | nothing outside itself |
| `application` | `domain` |
| `infrastructure` | `application` (ports), `domain`, external SDKs |
| `presentation/game` | `application`, `domain`, Phaser |
| `presentation/ui`, `composition`, `app` | anything inward |

## Runtime flow

1. `app/page.tsx` renders `GameApp` (client). It picks a layout from the viewport (`pickLayoutKind`), sizes
   the stage box to that layout's aspect ratio and mounts Phaser (`Scale.FIT`) plus React overlays in the
   same box, so overlay `%` positions line up with canvas coordinates. Rotating swaps layouts and remounts
   the scene; the session lives in `GameController`, so the day continues (auto-paused).
2. `ShopScene.update` ticks `ShopSession` only while `GameController.running`. The session emits
   `ShopEvent`s (arrived, served, cup…) which the scene turns into animation/sound; React re-renders through
   `useSyncExternalStore` on controller changes.
3. Player input → session commands (`takeCup`, `startPour`, `deliver`…). All rules (quality, payment,
   reputation, quests) are evaluated in domain/application code and are unit-tested without a browser.
4. Server routes call `serverServices()`; missing env vars degrade gracefully (`/api/health` reports status).

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
- **New screen size** → add a `Layout` to `LAYOUTS` and extend `pickLayoutKind`; `layout.test.ts` checks bounds.
