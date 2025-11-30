# Drag-and-drop panel reordering (Expo 54 / RN 0.81)

Research and implementation notes for adding draggable, reorderable panels in the Expo Router app while staying aligned with current dependencies and project conventions.

## Versions and compatibility

- Expo SDK: 54 (`expo` ^54.0.1)
- React Native: 0.81.4
- React Native Reanimated: ~4.1.0 (already installed with Babel plugin configured)
- React Native Gesture Handler: not yet listed; Expo 54 aligns with `~2.20.2` → add via `expo install react-native-gesture-handler@~2.20.2` when implementing.
- Expo Router: ~6.0.0 (page-layer only for data/navigation per atomic design).

## Recommended stack for drag + reorder

- Use `react-native-gesture-handler` + `react-native-reanimated` (Gesture API) for smooth, native-feel drags. Avoid JS-driven `PanResponder` for performance and jitter.
- Keep layout virtualization via `FlatList` (or `FlashList` if added later) so large lists stay performant; map panels to stable keys.
- Maintain UI styles through `className` (NativeWind) to match project standards; avoid inline `StyleSheet` unless dynamic values require it.

## Implementation outline

1. **Root wrapper**: Wrap the app once with `GestureHandlerRootView` (e.g., in `app/_layout.tsx` around `SafeAreaProvider` + `Stack`). Required for gesture-handler to work reliably across platforms and web.
2. **Data + state**: Keep ordering state in the page (or a page-level store via Zustand if the order is reused elsewhere). Pass ordered panel data + callbacks down to organisms/templates. Pages own data-fetching and persistence; lower layers stay presentation-first.
3. **Item layout tracking**: Use a shared map of positions/heights (e.g., `useSharedValue<{[key:string]: number}>`) updated on layout to compute target indices during a drag.
4. **Gesture**: For each card, create a `Gesture.Pan()` with `onUpdate` updating `translateY` shared value and `onEnd` running a reorder calculation. Minimize `runOnJS`; only call it once on drop to commit the new order to React state.
5. **Animation**: Use `useAnimatedStyle` + `withTiming`/`withSpring` for snap-back and sibling shifts. Ensure `zIndex`/`elevation` is raised while dragging to avoid overlap artifacts.
6. **Hit-slos + long-press**: Optional `Gesture.LongPress()` before `Pan()` helps avoid accidental drags on scrollable lists; compose with `Gesture.Simultaneous` as needed.
7. **Scroll support**: If the panels exceed viewport height, implement auto-scroll during drag (`scrollTo` on parent `ScrollView`/`FlatList` via `runOnJS`) gated by thresholds to prevent runaway scrolling.
8. **Persistence**: After drop, persist ordering if required (e.g., Supabase) from the page layer only; keep local optimistic order to prevent jank.
9. **Web**: Gesture Handler on web requires the root wrapper and no React Native Web polyfills beyond what Expo Router includes. Reanimated web works but avoid `console.log` inside worklets.

## Project-specific guidance

- **Atomic design placement**: The draggable list itself should live in an organism/template under `apps/mobile/src/components`, with the page in `apps/mobile/src/app/...` owning the data and handing props like `panels`, `onReorder`, and callbacks for persistence. Templates/organisms should not fetch or navigate.
- **Styling**: Use `className` utilities in the documented order (layout → sizing → spacing → border → background/color → typography → effects → state). Keep cards visually separated (`rounded-lg`, `shadow-*`) and add a drag handle icon (Lucide is available).
- **Accessibility**: Provide `accessibilityRole="button"` on handles, `accessibilityHint="Drag to reorder"`; expose an alternate reorder control (up/down buttons) if drag is not available (screen readers).
- **Performance**: Avoid frequent React re-renders during drag; keep movement in worklets. Debounce persistence writes to avoid hammering storage.
- **State safety**: Use stable keys and pure data transforms (`reorder(list, from, to)`) to prevent mutating state in place.
- **Dev reliability**: After wiring gestures, restart the bundler with cache clear (`pnpm dev -- --filter=mobile` then press `r`, or `pnpm --filter mobile start -c`) if animations don’t apply—Reanimated sometimes needs a fresh build.

## Minimal component sketch (pseudo)

```tsx
// Page (apps/mobile/src/app/some-page.tsx)
const [panels, setPanels] = useState<Panel[]>(initialPanels);
const handleReorder = useCallback((from: number, to: number) => {
  setPanels((prev) => reorder(prev, from, to));
  // Optional: persist here (Supabase) with debounce.
}, []);

<DragReorderPanelsTemplate panels={panels} onReorder={handleReorder} />;
```

```tsx
// Template/organism (apps/mobile/src/components/organisms/drag-reorder-panels.tsx)
const panGesture = Gesture.Pan()
  .activateAfterLongPress(120)
  .onStart(() => { activeKey.value = id; })
  .onUpdate((event) => { translateY.value = event.translationY; runReorderWorklet(); })
  .onEnd(() => { runOnJS(onDrop)(fromIndex, toIndex); resetAnimatedValues(); });
```

## Verification checklist (when implemented)

- `pnpm dev -- --filter=mobile` (hot reload) or `pnpm --filter mobile start -c` (clean) to ensure Reanimated picks up changes.
- Interact on iOS + Android simulators for drag, snap, and scroll responsiveness; verify no crashes in logs.
- Confirm ordering persists (if wired) and survives reload.
- If Gesture Handler is newly installed, run `pnpm --filter mobile ios|android` once to regenerate native modules in dev clients.

## Useful references

- Gesture Handler docs (Pan/LongPress + Gesture API): https://docs.swmansion.com/react-native-gesture-handler/docs/
- Reanimated Gesture tutorial (layout reordering patterns): https://docs.swmansion.com/react-native-reanimated/docs/
- Expo SDK 54 Gesture Handler versioning: https://docs.expo.dev/versions/latest/sdk/gesture-handler/
