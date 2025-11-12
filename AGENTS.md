# Repository Guidelines

## Project Structure & Module Organization
This pnpm + Turborepo workspace keeps runtime code under `apps/mobile`, an Expo Router app with screens in `src/app`, shared styles in `src/global.css`, and Tailwind/NativeWind tokens from `tailwind.config.js`. Tooling lives in `packages/eslint-config` (shared ESLint presets) and `packages/typescript-config` (tsconfig variants). `turbo.json` and `pnpm-workspace.yaml` expect every package to expose `build`, `dev`, `lint`, and `check-types` for dependency-aware pipelines.

## Build, Test, and Development Commands
- `pnpm dev` → `turbo run dev` launches every package’s dev server; scope to the Expo app with `pnpm dev -- --filter=mobile` or run `pnpm --filter mobile start` for raw Expo CLI.
- `pnpm build` → `turbo run build` compiles packages in topological order and caches artifacts; append `-- --filter=mobile` for app-only builds.
- `pnpm lint`, `pnpm check-types`, `pnpm format` enforce ESLint, TypeScript, and Prettier 3.
- Device targets: `pnpm --filter mobile ios|android|web` tunnels Expo to the requested simulator; `pnpm --filter mobile deploy` runs `expo export` plus `eas-cli`.

## Coding Style & Naming Conventions
Write everything in TypeScript with React function components. Import shared configs via `@repo/eslint-config/base` and `@repo/typescript-config/base`. Keep screens pascal-cased (`src/app/Home.tsx`), hooks prefixed with `use`, and shared utilities under `apps/mobile/src/lib`. Use Tailwind utility ordering `layout → spacing → color → state`, avoid inline styles unless necessary, and never disable lint without a linked issue.


## Security & Configuration Tips
`.env*` files are part of the Turbo cache inputs—store them locally and never commit secrets. When deploying, log into the shared Expo/EAS account before running `pnpm --filter mobile deploy`, and prefer secure storage (Expo config, remote secrets) over hard-coded API keys.


## Planning & Progress Logs
Before writing code, duplicate `plan_and_progress/_template.md` and capture the objective, scope, done criteria, and current status (`Planned`, `In Progress`, `Blocked`, `Completed`, or `Archived`). Update the same file as work advances: list verification commands you ran (`bun run lint`, `bun run ios`, etc.), summarize outcomes, attach logs/screenshots if useful, and note follow-ups. Once criteria pass, change the status to `Completed`, add the completion date, then move the file into `plan_and_progress/archive/` with a `YYYY-MM-DD-your-topic.md` name so open initiatives remain visible at the root.

## Docs First Mindset
Before installing and using new 3rd party packages like supabase or anything, ensure you look up the documentation first - like a senior engineer would - find the relevant documentation for our application and save it (with links) to the /docs folder. This is especially important with the newest Expo packages which you may not be familiar with.

## Agent-Specific Instructions
Resolve uncertainty by inspecting the code, running the obvious command, or reading logs—never guess API shapes or data contracts. Debug in the simplest order: apply the likely fix, rerun, inspect logs, then expand the search. Do not add defensive fallbacks that obscure errors, and never cast values to `any`; instead, correct the data at the source or tighten the type definitions. When cross-app issues arise, reproduce them via the relevant Turbo filter so both the failing app and the shared package builds together. Avoid feature gates/flags and any backwards compability changes - since our app is still unreleased.