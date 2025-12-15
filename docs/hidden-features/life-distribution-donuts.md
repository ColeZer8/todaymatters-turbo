# Life Distribution Donut Charts (Hidden Feature)

**Status:** Hidden (not deleted)  
**Date Hidden:** December 13, 2024  
**Location:** `apps/mobile/src/components/templates/AnalyticsTemplate.tsx`

---

## Overview

The Life Distribution section displays two side-by-side donut charts comparing the user's **Ideal** time allocation versus their **Reality** (actual logged time) across life pillars (Faith, Family, Work, Health, Free time, Other).

## Visual Description

- **Two donut charts** placed side-by-side
- **Left chart:** "IDEAL" - Shows the user's target time distribution
- **Right chart:** "REALITY" - Shows actual time spent based on logged activities
- **Helper text:** "These splits update automatically as you log time across pillars."
- **Dividers:** Horizontal lines above and below the section

## File Locations

### Main Template (where it's hidden)
```
apps/mobile/src/components/templates/AnalyticsTemplate.tsx
```
- Lines ~392-430 (commented out)
- The section is wrapped in JSX comments: `{/* START: Life Distribution Section (Hidden) ... END: Life Distribution Section (Hidden) */}`

### Donut Chart Component
```
apps/mobile/src/components/molecules/AnalyticsDonutChart.tsx
```
- Reusable animated donut chart component
- Supports smooth transitions when data changes
- Used by both IDEAL and REALITY charts

### Data Structure
The distribution data is defined in `ANALYTICS_SNAPSHOT` constant in `AnalyticsTemplate.tsx`:

```typescript
interface DistributionSlice {
  label: string;   // e.g., 'Faith', 'Family', 'Work', 'Health', 'Free time', 'Other'
  value: number;   // Percentage value
  color: string;   // Hex color for the slice
}

distribution: {
  ideal: DistributionSlice[];
  reality: DistributionSlice[];
}
```

Each range (today, week, month, year) has its own distribution data.

## How to Re-enable

1. Open `apps/mobile/src/components/templates/AnalyticsTemplate.tsx`
2. Find the section marked `{/* START: Life Distribution Section (Hidden)`
3. Uncomment the entire JSX block by:
   - Remove `{/* START: Life Distribution Section (Hidden)` 
   - Remove `END: Life Distribution Section (Hidden) */}`
   - Keep the descriptive comment at the top if desired
4. The section should now render between the range toggle and the "Time Spent vs. Goal" section

## Dependencies

- `AnalyticsDonutChart` molecule component (still active, used elsewhere)
- `idealDistribution` variable (still computed from `currentRange.distribution.ideal`)
- `currentRange.distribution.reality` data

## Reason for Hiding

Hidden per product decision to simplify the Analytics Overview screen. The feature is preserved for potential future reimplementation.

---

## Related Components

| Component | Path | Status |
|-----------|------|--------|
| AnalyticsDonutChart | `src/components/molecules/AnalyticsDonutChart.tsx` | Active |
| AnalyticsRangeToggle | `src/components/molecules/AnalyticsRangeToggle.tsx` | Active |
| AnalyticsTemplate | `src/components/templates/AnalyticsTemplate.tsx` | Active (section hidden) |


