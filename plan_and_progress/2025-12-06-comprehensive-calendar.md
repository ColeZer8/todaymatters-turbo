# Comprehensive Calendar View Implementation

## Overview
The "Comprehensive Calendar View" is a central feature designed to provide users with a high-density, "Planned vs. Actual" visualization of their day. It replaces the traditional list-based calendar with a professional, Google Calendar-style time grid (00:00 - 23:59).

## Key Objectives
1.  **Professional Aesthetic:** Move away from "sloppy" UI to a refined, boxy, and precise layout.
2.  **Planned vs. Actual:** A split-screen view (50/50) allowing users to compare their ideal schedule against their actual digital exhaust/tracked time.
3.  **Full Day Context:** Support for the full 24-hour cycle, including sleep tracking and late-night activities.
4.  **Interactivity:** Allow users to tap "Unknown" or unassigned blocks to categorize them via the "Review Time" flow.

## Technical Architecture

### 1. File Structure
*   **Route:** `apps/mobile/src/app/comprehensive-calendar.tsx`
*   **Template:** `apps/mobile/src/components/templates/ComprehensiveCalendarTemplate.tsx`
*   **Components:**
    *   `DateNavigator` (Custom in-file implementation for strict theming)
    *   `TimeEventBlock` (Internal component for rendering events)
    *   `BottomToolbar` (Updated to link to this new view)

### 2. Data Model
Events are mapped with the following structure:
```typescript
interface Event {
  id: string;
  title: string;
  description?: string;
  startMinutes: number; // Minutes from midnight (0 - 1439)
  duration: number;     // Minutes
  category: CategoryKey;
}
```

### 3. Category System
A strict color-coding system (`CATEGORY_STYLES`) ensures consistency between Scheduled and Actual columns:
*   **Routine:** Blue (`#3B82F6`)
*   **Work:** Slate (`#64748B`)
*   **Meal:** Orange (`#F97316`)
*   **Meeting:** Purple (`#A855F7`)
*   **Health:** Green (`#22C55E`)
*   **Family:** Pink (`#EC4899`)
*   **Sleep:** Indigo (`#312E81`)
*   **Unknown:** Dashed Gray (Interactive)

### 4. Layout Implementation
*   **Time Grid:** A vertical ScrollView with a fixed height based on `HOUR_HEIGHT` (80px).
*   **Positioning:** Absolute positioning is used for all event blocks:
    *   `top = (startMinutes / 60) * HOUR_HEIGHT`
    *   `height = (duration / 60) * HOUR_HEIGHT`
*   **Current Time Indicator:** A global `zIndex: 50` red line spanning the entire width, with a dot indicator on the time axis.

## Current Status
*   **Visuals:** The grid is implemented with a clean white background, subtle `#F1F5F9` grid lines, and precise time labels.
*   **Data:** Mock data reflects a realistic "messy" day, including oversleeping, social media usage, and commute times.
*   **Navigation:** The bottom toolbar correctly highlights only on this route.
*   **Issues:** Addressing a reported runtime error (likely variable shadowing or import issue) and refining text truncation for tiny events.

## Next Steps
1.  **Verify Fixes:** Confirm the "Render Error" is resolved.
2.  **Data Integration:** Replace mock data with real Supabase/Store data.
3.  **"Review Time" Connection:** Ensure the tap-to-assign flow fully updates the store.
