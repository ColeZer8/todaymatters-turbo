# Atomic Design in TodayMatters

We organize all UI work using Brad Frost’s [Atomic Design](https://bradfrost.com/blog/post/atomic-web-design/) system so the Expo Router app stays composable, testable, and ready for additional clients.

## Layer Overview

| Layer | Definition | Typical Examples | Source of Truth |
| --- | --- | --- | --- |
| **Atoms** | Single-purpose, styling-focused primitives with zero domain logic or state. | `Button`, `Text`, `Icon`, `Spacer` | `apps/mobile/src/components/atoms/*` |
| **Molecules** | Small clusters of atoms that work together to express a simple idea. | `SearchBar`, `LabeledInput`, `AvatarWithText` | `apps/mobile/src/components/molecules/*` |
| **Organisms** | Feature-level sections composed of molecules/atoms plus lightweight hooks. | `Header`, `TaskList`, `Hero`, `SettingsCard` | `apps/mobile/src/components/organisms/*` |
| **Templates** | Layout scaffolding that arranges organisms, leaving slot props for real data. | `DashboardLayout`, `OnboardingShell`, `AuthFlow` | `apps/mobile/src/components/templates/*` |
| **Pages (Expo Router screens)** | Routed experiences that own behavior: data fetching, global state, business logic, navigation, and URL params. | `src/app/index.tsx`, `src/app/(auth)/login.tsx` | `apps/mobile/src/app/**/*` |

Pages may import templates/organisms/molecules/atoms, but lower layers can never import upward. Templates can rely on organisms/molecules/atoms but never pages. Do **not** create alternate page directories (e.g., `src/pages` or `components/pages`); Expo Router’s `apps/mobile/src/app/**` tree is the authoritative place for screens even though they are part of the atomic hierarchy.

## Data & Side-Effect Boundaries

| Layer | Allowed Data Behaviors |
| --- | --- |
| **Atoms** | Receive props only; no hooks besides styling helpers; never touch context, storage, or network. |
| **Molecules** | Still purely presentational; can hold local UI state (`useState`) that doesn’t talk to services. |
| **Organisms** | Accept data via props; may use hooks for UI-only behavior (e.g., `useSafeAreaInsets`) but never fetch, mutate global stores, or depend on navigation. |
| **Templates** | Compose organisms and may wire global selectors or navigation helpers, but cannot fetch, mutate, or own business logic. |
| **Pages** | The only layer allowed to fetch data, make API calls, use global state, talk to services, dictate navigation, read URL params, and own screen-level events. Use colocated hooks/services as needed but keep side effects here. |

If a component needs data access that violates its layer, promote it instead of adding “just this once” fetch logic.

## Implementation Rules

1. **Create from the bottom up.** Extract atoms first, then compose them into molecules, organisms, templates, and finally pages.
2. **Colocate tests and stories.** Add `ComponentName.test.tsx` / `.stories.tsx` beside each shared component.
3. **Tailwind discipline.** Apply utilities in the following order to keep diffs readable:
   1. Layout & display (`flex`, `grid`, `absolute`, `inset-*`)
   2. Box model & sizing (`w-*`, `h-*`, `min-w-*`, overflow)
   3. Spacing (`m-*`, `p-*`, `gap-*`)
   4. Borders & radius (`border-*`, `rounded-*`)
   5. Background & color (`bg-*`, `text-*`, `shadow-*`)
   6. Typography (`font-*`, `text-*`, `leading-*`, `tracking-*`)
   7. Effects & transforms (`shadow-*`, `opacity-*`, `transform`, `transition-*`)
   8. State/variant prefixes (`hover:`, `focus:`, `active:`, `dark:`)
4. **Exports.** Each layer exposes an `index.ts` barrel so imports look like `import { PrimaryButton } from "@/components/atoms"`.
5. **Review check.** Every UI-related PR must fill out the snippet below so reviewers can confirm the layer boundaries:

   ```md
   ### Atomic Layer
   - Layer: <Atom | Molecule | Organism | Template | Page>
   - Reason: <Why this abstraction fits the chosen layer>
   ```

Remember: **Pages own behavior. Templates own structure. Organisms own sections. Molecules own clusters. Atoms own primitives.** Staying strict on those boundaries keeps the React Native surface predictable and ready for future backend flows without duplication.
