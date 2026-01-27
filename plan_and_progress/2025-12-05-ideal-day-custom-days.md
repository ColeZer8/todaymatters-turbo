# Ideal Day Custom Days Feature

- Status: Completed
- Owner: Cole
- Started: 2025-12-05
- Completed: 2025-12-05

## Objective

Enhance the Ideal Day page with visual indicators showing which days have been configured, and add a robust "custom day" system that allows users to override any day's base schedule with a custom configuration.

## Plan

1. Add configuration indicator dots to day buttons
2. Implement two-dot system (blue = base configured, orange = custom override)
3. Create per-day custom configuration storage
4. Enable single-day custom selection with auto-save on switch
5. Inherit from base template when selecting a custom day

## Done Criteria

- Blue dot appears on days whose base template (weekdays/saturday/sunday) has been customized
- Orange dot appears on days with custom overrides
- Orange dot always visible (white border for contrast on any background)
- Only one day can be custom at a time
- Selecting a custom day inherits from its base template
- Switching days auto-saves the current custom config
- Tapping same day removes custom override (reverts to base)
- All custom configs persist across app restarts

## Progress

- 2025-12-05: Added `configuredDays` logic to show blue dots on days with non-default base templates
- 2025-12-05: Implemented two-dot system with blue (top-right) for base config and orange (top-left) for custom override
- 2025-12-05: Fixed store's `setDayType` to preserve selections when switching tabs
- 2025-12-05: Restricted custom mode to single-day selection
- 2025-12-05: Added `customDayConfigs` to store per-day custom configurations
- 2025-12-05: Updated `toggleDay` to auto-save current config when switching days
- 2025-12-05: Custom days now inherit from base template on first selection
- 2025-12-05: Added serialization/deserialization for `customDayConfigs` with icon handling
- 2025-12-05: Orange dot styled with white border for visibility on all backgrounds

## Verification

- No lint errors in modified files
- Store properly serializes/deserializes `customDayConfigs` with icons
- Custom configs persist in AsyncStorage

## Outcomes

### Files Modified

- `apps/mobile/src/stores/ideal-day-store.ts`
  - Added `customDayConfigs: Record<number, IdealDayCategory[]>` to state
  - Updated `toggleDay` to save/load custom configs and enforce single selection
  - Fixed `setDayType` to only change `dayType` (preserves selections)
  - Added serialization for `customDayConfigs`

- `apps/mobile/src/components/templates/IdealDayTemplate.tsx`
  - Added `customDayConfigs` prop
  - Added `baseConfiguredDays` computation for blue dots
  - Added `customDays` computation for orange dots
  - Implemented two-dot rendering system
  - Added dynamic helper text for custom mode

- `apps/mobile/src/app/ideal-day.tsx`
  - Added `customDayConfigs` to props passed to template

### Visual Design

| Indicator         | Position  | Color                    | Meaning                  |
| ----------------- | --------- | ------------------------ | ------------------------ |
| Blue dot (6px)    | Top-right | `#2563EB`                | Base template configured |
| Orange dot (10px) | Top-left  | `#F59E0B` + white border | Custom override active   |

### User Flow

1. Configure weekdays → Mon-Fri show blue dots
2. Go to Custom tab → helper text: "Tap a day to customize"
3. Tap Monday → Monday inherits weekdays config, orange dot appears
4. Adjust sliders → Changes apply to Monday's custom
5. Tap Tuesday → Monday auto-saved, Tuesday now editing
6. Both Mon & Tue have orange dots
7. Tap Monday again → Monday's custom deleted, reverts to weekdays

## Follow-ups

- Consider adding visual feedback when auto-saving (subtle toast or animation)
- May want to show which base template a custom day inherited from
- Could add "reset to base" button in custom mode UI
