# Repository Guidelines

## Project Structure & Module Organization
This pnpm + Turborepo workspace keeps runtime code under `apps/mobile`, an Expo Router app with screens in `src/app`, shared styles in `src/global.css`, and Tailwind/NativeWind tokens from `tailwind.config.js`. Tooling lives in `packages/eslint-config` (shared ESLint presets) and `packages/typescript-config` (tsconfig variants). `turbo.json` and `pnpm-workspace.yaml` expect every package to expose `build`, `dev`, `lint`, and `check-types` for dependency-aware pipelines.

## Build, Test, and Development Commands
- `pnpm dev` → `turbo run dev` launches every package’s dev server; scope to the Expo app with `pnpm dev -- --filter=mobile` or run `pnpm --filter mobile start` for raw Expo CLI.
- `pnpm build` → `turbo run build` compiles packages in topological order and caches artifacts; append `-- --filter=mobile` for app-only builds.
- `pnpm lint`, `pnpm check-types`, `pnpm format` enforce ESLint, TypeScript, and Prettier 3.
- Device targets: `pnpm --filter mobile ios|android|web` tunnels Expo to the requested simulator; `pnpm --filter mobile deploy` runs `expo export` plus `eas-cli`.
- Mobile dev server: prefer `pnpm dev -- --filter=mobile` so Turbo launches the Expo CLI. The `apps/mobile/scripts/expo-dev.mjs` wrapper strips Turbo’s `--filter` flag and forces `--host localhost` so the Expo UI and any local backend stay on the same origin. Run `pnpm --filter mobile start` only when you explicitly need standalone Expo.

## Coding Style & Naming Conventions
Write everything in TypeScript with React function components. Import shared configs via `@repo/eslint-config/base` and `@repo/typescript-config/base`. Keep screens pascal-cased (`src/app/Home.tsx`), hooks prefixed with `use`, and shared utilities under `apps/mobile/src/lib`. Use Tailwind utility ordering `layout → spacing → color → state`, avoid inline styles unless necessary, and never disable lint without a linked issue.

- **Atomic design required.** Build UI from atoms → molecules → organisms → templates → pages per `docs/atomic-design.md`. Shared UI lives under `apps/mobile/src/components/{atoms,molecules,organisms,templates}`; Expo Router screens stay in `apps/mobile/src/app/**`. Pages may import lower layers, but templates and below can never import pages. Only pages fetch data, call APIs, use global state, invoke business logic, read URL params, or dictate navigation. Always include the `### Atomic Layer` snippet in PRs and explain the layer choice.
- **Tailwind ordering.** Apply utilities in the documented order (layout → sizing → spacing → border → background/color → typography → effects → state). If a utility falls outside that list, default to the closest bucket and avoid reordering-only diffs.

### General Code Style & Formatting
- Use functional, declarative patterns (no React class components); favor composition and iteration over duplication.
- Name variables descriptively with auxiliaries (`isLoading`, `hasError`) and structure files as: exported component → subcomponents → helpers → static content → types.
- Prefer named exports and lowercase-dashed directories (e.g., `components/auth-wizard`).
- Always follow Expo documentation for setup/config and rely on project tooling (`pnpm format`) for Prettier enforcement.

### TypeScript Best Practices
- Write everything in TypeScript, enable/retain strict mode, and prefer `interface` declarations to `type` aliases when describing object shapes.
- Avoid `any` and `enum`; use specific literals, discriminated unions, or maps.
- Type functional components with explicit props interfaces, and keep data contracts tight instead of casting.

### React Native & Styling Rules
- Favor Expo/React Native primitives plus NativeWind for styling (styled-components acceptable only when Tailwind cannot express the requirement).
- Implement responsive design with Flexbox + `useWindowDimensions`, support dark mode via `useColorScheme`, and ensure accessibility by adding roles/ARIA/native accessibility props.
- Use `react-native-reanimated` and `react-native-gesture-handler` for animations/gestures requiring high performance.
- Keep shared styles in `apps/mobile/src/global.css`; avoid inline styles except for dynamic values that Tailwind cannot cover.


## Security & Configuration Tips
`.env*` files are part of the Turbo cache inputs—store them locally and never commit secrets. When deploying, log into the shared Expo/EAS account before running `pnpm --filter mobile deploy`, and prefer secure storage (Expo config, remote secrets) over hard-coded API keys.


## Planning & Progress Logs
Before writing code, duplicate `plan_and_progress/_template.md` and capture the objective, scope, done criteria, and current status (`Planned`, `In Progress`, `Blocked`, `Completed`, or `Archived`). Update the same file as work advances: list verification commands you ran (`bun run lint`, `bun run ios`, etc.), summarize outcomes, attach logs/screenshots if useful, and note follow-ups. Once criteria pass, change the status to `Completed`, add the completion date, then move the file into `plan_and_progress/archive/` with a `YYYY-MM-DD-your-topic.md` name so open initiatives remain visible at the root.

## Docs First Mindset
Before installing and using new 3rd party packages like supabase or anything, ensure you look up the documentation first - like a senior engineer would - find the relevant documentation for our application and save it (with links) to the /docs folder. This is especially important with the newest Expo packages which you may not be familiar with.

## Agent-Specific Instructions
Resolve uncertainty by inspecting the code, running the obvious command, or reading logs—never guess API shapes or data contracts. Debug in the simplest order: apply the likely fix, rerun, inspect logs, then expand the search. Do not add defensive fallbacks that obscure errors, and never cast values to `any`; instead, correct the data at the source or tighten the type definitions. When cross-app issues arise, reproduce them via the relevant Turbo filter so both the failing app and the shared package builds together. Avoid feature gates/flags and any backwards compability changes - since our app is still unreleased.
