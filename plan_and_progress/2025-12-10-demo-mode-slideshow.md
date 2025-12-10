# Demo Mode / Dev Slideshow

- Status: Completed
- Owner: Cole
- Started: 2025-12-10
- Completed: 2025-12-10

## Objective

Create an interactive demo mode that allows stakeholders to showcase the app's time-triggered and action-triggered screens (good morning, traffic alerts, meeting reminders) without relying on real-time triggers or user actions. The demo should feel like the real app with overlay controls for navigation and time simulation.

## Plan

1. ~~Create dedicated demo carousel route~~ (abandoned in favor of overlay approach)
2. Create `useDemoStore` Zustand store for demo state management (time simulation, active state)
3. Create `DemoOverlay` organism as persistent overlay at app root
4. Integrate time simulation into existing components (`Greeting`, `ComprehensiveCalendarTemplate`)
5. Create specialized demo screens:
   - `DemoMorningRoutine` - Wake Up / Devotional view
   - `DemoMeetingReminder` - Upcoming meeting notification
   - `DemoTrafficAlert` - Traffic/departure alert with map
6. Add demo mode activation from Profile settings (dev-only)
7. Implement guided tour navigation with arrows and quick-jump buttons

## Done Criteria

- [x] Demo mode accessible from Profile settings (only in `__DEV__`)
- [x] Persistent overlay with controls (time presets, navigation, exit)
- [x] Time simulation affects Greeting and Calendar components
- [x] Wake Up screen matches design reference
- [x] Meeting Reminder screen matches design reference  
- [x] Traffic Alert screen matches design reference (including slashed-zero timer font)
- [x] Guided tour navigation between demo pages
- [x] Controls hidden until user taps corner button

## Progress

- 2025-12-10: Initial implementation with carousel approach
- 2025-12-10: Pivoted to overlay approach per user feedback (app should remain interactive)
- 2025-12-10: Created `useDemoStore` with time presets (Morning, Midday, Afternoon, Evening, Night, Wake Up)
- 2025-12-10: Integrated time simulation into `Greeting` and `ComprehensiveCalendarTemplate`
- 2025-12-10: Created `DemoMorningRoutine` with exact spacing matching `HomeTemplate`
- 2025-12-10: Created `DemoMeetingReminder` for meeting notification demo
- 2025-12-10: Created `DemoTrafficAlert` with SVG map and departure timer
- 2025-12-10: Refined timer font to use `Menlo-Bold` for slashed zeros

## Files Changed

### New Files
- `apps/mobile/src/stores/demo-store.ts` - Zustand store for demo state
- `apps/mobile/src/components/organisms/DemoOverlay.tsx` - Persistent demo controls overlay
- `apps/mobile/src/components/organisms/DemoMorningRoutine.tsx` - Wake Up screen
- `apps/mobile/src/components/organisms/DemoMeetingReminder.tsx` - Meeting reminder screen
- `apps/mobile/src/components/organisms/DemoTrafficAlert.tsx` - Traffic alert with map
- `apps/mobile/src/app/demo-meeting.tsx` - Route for meeting demo page
- `apps/mobile/src/app/demo-traffic.tsx` - Route for traffic demo page

### Modified Files
- `apps/mobile/src/app/_layout.tsx` - Added `DemoOverlay` to app root, new routes
- `apps/mobile/src/app/profile.tsx` - Added "Demo Mode" menu item (dev-only)
- `apps/mobile/src/components/molecules/Greeting.tsx` - Integrated demo time simulation
- `apps/mobile/src/components/templates/HomeTemplate.tsx` - Conditional render for `DemoMorningRoutine`
- `apps/mobile/src/components/templates/ComprehensiveCalendarTemplate.tsx` - Uses simulated time when demo active
- `apps/mobile/src/stores/index.ts` - Export demo store
- `apps/mobile/src/components/organisms/index.ts` - Export new demo components

## Technical Details

### Demo Store (`useDemoStore`)
```typescript
interface DemoState {
  isActive: boolean;
  timeOfDay: TimeOfDay;
  simulatedHour: number;
  simulatedMinute: number;
  greeting: string;
}
```

### Time Presets
| Preset | Hour | Greeting |
|--------|------|----------|
| Wake Up | 6:00 | devotional view |
| Morning | 8:30 | Good morning |
| Midday | 12:00 | Good afternoon |
| Afternoon | 15:00 | Good afternoon |
| Evening | 18:30 | Good evening |
| Night | 21:00 | Good night |

### Demo Tour Pages
1. Home (with time-responsive greeting)
2. Meeting Reminder (`/demo-meeting`)
3. Traffic Alert (`/demo-traffic`)

### Traffic Alert Map
- SVG-based map with curved route paths
- Color-coded route: Blue → Red (accident) → Blue
- Yellow toll route alternative
- Triangle warning marker for accident location
- "32 min / Tolls" badge

### Timer Font
- Uses `Menlo-Bold` (iOS) / `monospace` (Android) for slashed zeros

## Verification

- `pnpm lint` - Pass
- `pnpm check-types` - Pass
- Manual QA on iOS simulator - Demo mode activates from Profile, all screens display correctly

## Outcomes

- Stakeholders can now demo time-triggered features without waiting for real triggers
- Demo mode is dev-only (`__DEV__` guard) so won't appear in production builds
- Overlay approach keeps app fully interactive while providing navigation controls

## Follow-ups

- [ ] Add more demo screens as new features are built (notifications, voice coach, etc.)
- [ ] Consider adding "scenario" presets (e.g., "Morning Routine Demo", "Commute Demo")
- [ ] Add ability to customize demo user name (currently hardcoded as "Paul")
