# Landing: Make Footer/Nav Links Functional (Today Matters-first pages)

- Status: Completed
- Owner: Cole + Cursor agent
- Started: 2026-01-05
- Completed: 2026-01-05

## Objective

Make the landing page’s bottom/footer (and other placeholder) links functional by routing to on-brand internal pages. Copy should remain Today Matters-first, with only subtle inspiration from The Data Group’s public positioning (e.g., “data is honest” as a mindset).

## Plan

1. Inventory all placeholder `"#"` links and broken anchors.
2. Add Next.js App Router routes for each destination (About, Blog, Download, Legal, etc.).
3. Update components to point to the new routes without changing visual design.

## Done Criteria

- No `href="#"` placeholders remain in landing UI.
- Footer + navbar + CTA links navigate to real pages (no 404s for footer/nav/social).
- `pnpm lint --filter landing` and `pnpm check-types --filter landing` pass.

## Progress

- 2026-01-05: Rewired footer/nav/CTA links, added destination routes, and rewrote copy to be Today Matters-first.

## Verification

- `pnpm lint --filter landing` (pass; warnings only)
- `pnpm check-types --filter landing` (pass)

## Outcomes

- Footer/nav/CTA links are now functional and route to new internal pages.

## Follow-ups

- If we later add real App Store / Play Store URLs, update `/download` to point to them.


