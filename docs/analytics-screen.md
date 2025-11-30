# Analytics screen updates

## What changed
- Added `AnalyticsTemplate` with overview, rhythm time, focus areas, and deep-dive insight sections for today/week/month ranges.
- Created reusable molecules (`AnalyticsRangeToggle`, `AnalyticsBarChart`, `AnalyticsCategoryCard`) to render the new analytics UI.
- Added the `/analytics` route and wired the bottom toolbar bar-chart icon to navigate there; exported the template for page use.
- Seeded representative data for each range to showcase scores, trends, and optimization suggestions per category.
- Refined layout to match the first analytics page: performance insight card, range toggle (today/week/month/year), time-spent-vs-goal bars, category health grid, and life distribution donut with ideal/reality toggle.
- Iterated on the life distribution donut (thicker ring, tighter center label, adjusted radius) and legend spacing to avoid clipping; kept free time starting at 12 o’clock for consistent alignment.

## How to use
- From the home toolbar, tap the analytics (bar chart) icon to open the new screen, or navigate to `/analytics` via `router.replace('/analytics')`.
- Switch ranges with the toggle in the header; tap any focus area card to update the deep-dive panel below.

## Follow-ups
- Replace static sample data with live analytics once available.
- Add validation to ensure category data stays in sync with backend schema when connected.
