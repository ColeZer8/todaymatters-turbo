# Demo Mode Analytics Screens & Full Goals/Initiatives Functionality

- Status: Completed
- Owner: Cole
- Started: 2025-12-11
- Completed: 2025-12-11

## Objective

Add six new demo screens to the demo mode tour, make Goals and Initiatives fully functional with CRUD operations, ensure consistent blue theming across all pages, and integrate the new analytics screens into the main Analytics page with a clean tab selector.

## Plan

1. Create 6 new demo screens (interruption, workout summary, traffic accident, goals overview, initiatives overview, values overview)
2. Register all new routes and add to demo tour navigation
3. Make Goals and Initiatives pages functional with Zustand stores
4. Add edit mode with add/delete capabilities
5. Fix color theming across all pages (consistent blue colorway)
6. Fix activity rings layout on Workout Summary page
7. Integrate Goals and Initiatives into main Analytics page with tab selector
8. Redesign tab selector placement (moved from fixed top to scrollable content)

## Done Criteria

- [x] All 6 demo screens created and navigable via arrow buttons
- [x] Goals page fully functional (add/delete goals and tasks, mark complete)
- [x] Initiatives page fully functional (add/delete initiatives and milestones, mark complete)
- [x] All header colored text consistently blue (#2563EB)
- [x] Activity rings display correctly on Workout Summary
- [x] Traffic Accident page uses blue colorway
- [x] Analytics page has tab selector for Overview/Goals/Initiatives
- [x] Tab selector positioned within scrollable content area
- [x] No linting errors

## Progress

### 2025-12-11: Initial Demo Screens
- Created `DemoWorkoutInterruption.tsx` - Social media interruption alert with stop icon, countdown timer, and upcoming workout event card
- Created `DemoWorkoutSummary.tsx` - Apple-style workout analytics with nested activity rings, stat cards (calories, duration, heart rate), daily progress bars, and achievement card
- Created `DemoTrafficAccident.tsx` - Traffic alert with SVG map showing accident, old route (red dashed), new route, ETA/distance cards, and navigation button
- Created `DemoOverviewGoals.tsx` - Goals analytics with progress ring, weekly activity chart, AI insight, and goal cards
- Created `DemoOverviewInitiatives.tsx` - Initiatives analytics with progress stats, milestone tracking, and initiative cards
- Created `DemoOverviewValues.tsx` - Values analytics with radar chart, alignment score, and value category cards
- Registered all routes in `_layout.tsx` and added to `DEMO_TOUR` array in `DemoOverlay.tsx`

### 2025-12-11: Goals & Initiatives Functionality
- Created `goals-store.ts` - Zustand store with persistence for goals and tasks
  - Interfaces: `Goal`, `GoalTask`
  - Functions: `addGoal`, `updateGoal`, `deleteGoal`, `addTask`, `updateTask`, `toggleTask`, `deleteTask`, `importFromOnboarding`
  - Computed: `getOverallProgress`, `getCompletedTasksCount`, `getPendingTasksCount`
- Created `initiatives-store.ts` - Zustand store with persistence for initiatives and milestones
  - Interfaces: `Initiative`, `Milestone`
  - Functions: `addInitiative`, `updateInitiative`, `deleteInitiative`, `addMilestone`, `updateMilestone`, `toggleMilestone`, `deleteMilestone`, `importFromOnboarding`
  - Computed: `getOverallProgress`, `getCompletedMilestonesCount`, `getPendingMilestonesCount`, `getUpcomingDeadlines`
- Updated `stores/index.ts` to export new stores and types
- Integrated stores into `DemoOverviewGoals.tsx` and `DemoOverviewInitiatives.tsx`
- Added interactive components: `GoalCard`, `InitiativeCard`, `AddTaskInput`, `AddMilestoneInput`, `AddGoalSection`, `AddInitiativeSection`
- Auto-import from onboarding data on first load

### 2025-12-11: Edit Mode & Theming
- Added `isEditing` state with Edit/Done toggle button to Goals and Initiatives pages
- Conditionally render add/delete UI elements based on edit mode
- Fixed all header colored text to blue (#2563EB):
  - `DemoWorkoutInterruption.tsx`: "Paul." red → blue
  - `DemoWorkoutSummary.tsx`: "Paul!" green → blue
  - `DemoTrafficAccident.tsx`: "Paul." yellow → blue
  - `DemoOverviewValues.tsx`: "Overview" pink → blue
- Fixed `DemoWorkoutSummary.tsx` activity rings layout (proper centering with absolute positioning)
- Updated `DemoTrafficAccident.tsx` to blue colorway (route, button, badge, map elements)
- Updated `DemoOverviewValues.tsx` icons and cards to blue theme

### 2025-12-11: Analytics Page Integration
- Modified `AnalyticsTemplate.tsx` to include tab navigation
- Created `TabSelector` component with Overview, Goals, Initiatives options
- Added `activeTab` state to switch between views
- Added `embedded` prop to Goals and Initiatives components
- Embedded mode renders content-only (no ScrollView/KeyboardAvoidingView wrappers)

### 2025-12-11: Tab Selector Redesign
- Moved tab selector from fixed top position to scrollable content area
- Redesigned as pill-style segmented control:
  - Gray background container with rounded-full shape
  - Active tab has white background with subtle shadow
  - Blue icon/text when active, gray when inactive
- Updated embedded Goals/Initiatives to render content directly into parent ScrollView

## Verification

- `pnpm lint` - No errors in modified files
- `ReadLints` on all modified files - No linter errors found
- Manual testing of demo tour navigation
- Manual testing of Goals/Initiatives CRUD operations

## Files Changed

### New Files Created
- `apps/mobile/src/components/organisms/DemoWorkoutInterruption.tsx`
- `apps/mobile/src/components/organisms/DemoWorkoutSummary.tsx`
- `apps/mobile/src/components/organisms/DemoTrafficAccident.tsx`
- `apps/mobile/src/components/organisms/DemoOverviewGoals.tsx`
- `apps/mobile/src/components/organisms/DemoOverviewInitiatives.tsx`
- `apps/mobile/src/components/organisms/DemoOverviewValues.tsx`
- `apps/mobile/src/app/demo-workout-interruption.tsx`
- `apps/mobile/src/app/demo-workout-summary.tsx`
- `apps/mobile/src/app/demo-traffic-accident.tsx`
- `apps/mobile/src/app/demo-overview-goals.tsx`
- `apps/mobile/src/app/demo-overview-initiatives.tsx`
- `apps/mobile/src/app/demo-overview-values.tsx`
- `apps/mobile/src/stores/goals-store.ts`
- `apps/mobile/src/stores/initiatives-store.ts`

### Modified Files
- `apps/mobile/src/app/_layout.tsx` - Added 6 new Stack.Screen entries
- `apps/mobile/src/components/organisms/DemoOverlay.tsx` - Updated DEMO_TOUR array
- `apps/mobile/src/components/organisms/index.ts` - Exported new organisms
- `apps/mobile/src/stores/index.ts` - Exported new stores and types
- `apps/mobile/src/components/templates/AnalyticsTemplate.tsx` - Added tab navigation and embedded views

## Outcomes

### New Stores Architecture
```
stores/
├── goals-store.ts      # Goal & GoalTask management with persistence
├── initiatives-store.ts # Initiative & Milestone management with persistence
└── index.ts            # Barrel exports
```

### Demo Tour Flow
```
Home → Focus Alert → Workout → Meeting → Traffic → Departure → Prayer → Goals → Initiatives → Values
```

### Analytics Tab Structure
```
Analytics Page
├── Overview (original analytics content)
├── Goals (DemoOverviewGoals embedded)
└── Initiatives (DemoOverviewInitiatives embedded)
```

### Tab Selector Design
- Pill-style segmented control within scrollable content
- Subtle shadow on active tab
- Blue (#2563EB) accent for active state
- Scrolls with content instead of fixed position

## Follow-ups

- Consider adding data visualization charts for Goals weekly activity (currently simplified)
- Future: Connect workout summary to Apple HealthKit
- Future: Add date picker for initiative milestone due dates
- Consider adding swipe gestures to navigate between analytics tabs


