# Build Routine drag-and-drop guide (step 10)

Research + implementation plan to make the Build your routine page’s habit cards draggable with smooth reordering, matching the provided UI (Step 10/11).

## Environment and versions

- Expo SDK 54 (`expo` ^54.0.1)
- React Native 0.81.4
- Reanimated ~4.1.0 (already configured with the Babel plugin)
- Gesture Handler: install `react-native-gesture-handler@~2.20.2` via `expo install` (not present yet)
- Router: Expo Router ~6.0.0

## UX goals from the design

- Entire habit card moves as a unit (icon, title, minutes, delete) with elevation and shadow lift while dragging.
- Stable, predictable reorder: card slides smoothly into its new slot, siblings shift with spring.
- Accidental drags prevented: require a press on a drag affordance (handle or long-press) before movement.
- Visual polish: keep rounded card + soft shadow, subtle scale (e.g., 1.02) on active drag, opacity of non-active cards unchanged, hit area generous.
- A11y: drag handle has role/button + hint (“Drag to reorder”). Provide fallback up/down buttons if needed for screen readers.
- Jank-free: movement stays on the UI thread; React state updates only on drop.

## Structure (atomic design)

- Page: `apps/mobile/src/app/build-routine.tsx` continues to own data, reorder persistence (Zustand), navigation.
- Template: `RoutineBuilderTemplate` delegates visual list to a new organism.
- Organism: add `DraggableRoutineList` under `apps/mobile/src/components/organisms/` (or as a molecule + composed organism) that renders cards and handles drag logic via Gesture Handler + Reanimated.
- Molecule: keep `RoutineItemCard` mostly presentational; allow a `renderHandle` slot or `showHandle` prop so the card can host the drag affordance.

## Implementation checklist

1. **Dependency + root wrapper**
   - Add Gesture Handler: `expo install react-native-gesture-handler@~2.20.2`.
   - Wrap app root in `GestureHandlerRootView` (e.g., in `app/_layout.tsx` around `SafeAreaProvider`).
   - Restart bundler with cache clear after adding: `pnpm --filter mobile start -c` (or `pnpm dev -- --filter=mobile` then press `r`).

2. **Layout + measurement**
   - Each card reports height via `onLayout`; store per-id height + cumulative offsets in a shared object (`useSharedValue<Record<string, number>>`) so the worklet can map translation to target index.
   - Keep `FlatList` (non-scroll today) but ensure layout container allows overflow; for many items, enable scrolling and optional auto-scroll on drag near edges.

3. **Gesture + animation**
   - Create a `Gesture.Pan()` per card; gate start with `.activateAfterLongPress(120)` or a dedicated handle `Gesture.Tap()` that sets `activeId`.
   - Worklet state: `positions` map (id → current order index) and `activeId` shared value.
   - On update: adjust `translateY` for active card; compute potential new index by comparing the dragged card’s mid-point to sibling centers; swap indices in `positions` when crossing thresholds to animate siblings.
   - Styles: `useAnimatedStyle` with `transform: [{ translateY }, { scale: active ? 1.02 : 1 }]` and elevated shadow (e.g., `shadowOpacity` bump and `zIndex`/`elevation` while active).
   - On end: snap card to its slot (`withSpring`), reset `activeId`, and call `runOnJS(onReorder)` once with the new ordered array derived from `positions`.

4. **Visuals**
   - Card container: `className="rounded-2xl border border-[#E4E8F0] bg-white"` with existing shadow; while dragging, add `shadow-[0_8px_24px_rgba(15,23,42,0.12)]`.
   - Drag handle: small grip icon (e.g., `GripVertical` from Lucide) on the left or right; keep padding so it’s easy to grab.
   - Maintain current typography and spacing; keep delete/minutes controls functional and test that gestures don’t conflict with pressables (use `Gesture.Simultaneous` if needed).

5. **State + reorder function**
   - Pure reorder helper: `reorder(list, fromIndex, toIndex)` without in-place mutation.
   - Persist to store: call `setItems(newOrder)` from page/template after drop; consider debouncing if later syncing to backend.

6. **Accessibility + touch**
   - Handle gets `accessibilityRole="button"` and `accessibilityHint="Drag to reorder"`.
   - Larger touch targets (minimum 44x44) for handle and delete icons.
   - Optional: add haptic feedback on drag start/end (`expo-haptics`) if we decide to include the dependency later.

7. **Testing plan**
   - Simulators: iOS + Android—verify drag start, reorder, snap, delete tap still works, long-press gating prevents accidental drags.
   - Web: confirm Gesture Handler works (root wrapper) and Reanimated errors are absent; avoid `console.log` inside worklets.
   - Commands: `pnpm --filter mobile start -c` (for cache clear after adding gestures), then manual QA.

## Visual micro-interaction suggestions

- Active card: scale 1.02, shadow elevate, `opacity` unchanged.
- Siblings: slight `withTiming` shift to their new positions; avoid opacity changes to reduce flicker.
- Drop: `withSpring` stiffness ~280, damping ~24 for crisp snap.
- Long lists: optional auto-scroll when `absoluteY` nears top/bottom inset.

## Notes for next iteration

- Ensure `RoutineItemCard` exposes a handle slot; avoid wrapping the whole card in a Pressable that could compete with the drag handle.
- If expanded panel (time allotment) is open, decide whether to disable dragging or collapse on drag start for predictability.
- Keep styling via `className`; avoid introducing `StyleSheet.create` unless necessary for dynamic elevation differences on Android.

## Implementation status (2025-11-29)

- Installed `react-native-gesture-handler@~2.20.2` and wrapped the app root in `GestureHandlerRootView` for gesture support across iOS/Android/Web.
- Added `DraggableRoutineList` organism (Reanimated + Gesture Handler Pan with long-press gating) that animates translate/scale; drag handle removed for cleaner visuals (long-press anywhere on the card to drag).
- Wired `RoutineBuilderTemplate` to use the draggable list; drag start collapses expanded cards to keep measurements stable and avoid jitter.
- Expanded panel still shows start/end times and minute controls; drag remains long-press gated to prevent accidental drags on content controls.
- Card tap behavior: tapping anywhere on a card toggles the time editor; delete/minus/plus/Done buttons stop propagation so they don’t toggle or interfere with drag.
