import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Clean Architecture dependency rule, enforced by lint:
 * app/composition → presentation/infrastructure → application → domain.
 * Inner layers may never import outer layers or delivery frameworks.
 */
const layer = (name, patterns, message) => ({
  name: `layers/${name}`,
  files: [`src/${name}/**/*.{ts,tsx}`],
  rules: { "no-restricted-imports": ["error", { patterns: [{ group: patterns, message }] }] },
});

const FRAMEWORKS = ["phaser", "phaser/*", "react", "react-dom", "react/*", "next", "next/*", "@upstash/*", "server-only"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  layer(
    "domain",
    ["@/application/*", "@/infrastructure/*", "@/presentation/*", "@/composition/*", "@/app/*", ...FRAMEWORKS],
    "domain is the innermost layer: pure rules only, no outer layers or frameworks.",
  ),
  layer(
    "application",
    ["@/infrastructure/*", "@/presentation/*", "@/composition/*", "@/app/*", ...FRAMEWORKS],
    "application may depend only on domain; reach the outside world through ports.ts.",
  ),
  layer("infrastructure", ["@/presentation/*", "@/composition/*", "@/app/*"], "infrastructure implements application ports; it must not know the UI or wiring."),
  layer("presentation/game", ["@/infrastructure/*", "@/app/*", "@/composition/*"], "the Phaser view talks to the application only."),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "art-src/**", "scripts/**", "admin/**"]),
]);

export default eslintConfig;
