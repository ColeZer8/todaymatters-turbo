import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

interface HardenedSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Visuals */
  fillColor: string;
  trackColor?: string;
  trackHeight?: number;
  thumbSize?: number;
  /** Padding around the track that still responds to touch */
  hitSlopPx?: number;
  accessibilityLabel?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToStep(value: number, step: number) {
  if (step <= 0) return value;
  // Avoid floating point drift for steps like 0.5
  const inv = 1 / step;
  return Math.round(value * inv) / inv;
}

export function HardenedSlider({
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  fillColor,
  trackColor = '#F1F5F9',
  trackHeight = 12,
  thumbSize = 28,
  hitSlopPx = 14,
  accessibilityLabel,
}: HardenedSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const lastEmittedRef = useRef<number>(value);

  const innerTrackWidth = Math.max(0, trackWidth);
  const clampedValue = clamp(value, min, max);
  const range = Math.max(1e-6, max - min);
  const filledPx = innerTrackWidth * ((clampedValue - min) / range);

  const emitFromX = useCallback(
    (rawX: number) => {
      if (disabled) return;
      if (innerTrackWidth <= 0) return;

      // rawX is relative to the gesture view; subtract our padding to get track-local.
      const x = clamp(rawX - hitSlopPx, 0, innerTrackWidth);
      const ratio = x / innerTrackWidth;
      const rawValue = min + ratio * (max - min);
      const next = clamp(roundToStep(rawValue, step), min, max);

      if (Object.is(next, lastEmittedRef.current)) return;
      lastEmittedRef.current = next;
      onChange(next);
    },
    [disabled, innerTrackWidth, hitSlopPx, max, min, onChange, step]
  );

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    // Keep in sync with external controlled value so we don't suppress legitimate updates.
    lastEmittedRef.current = value;
  }, [value]);

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      // Require meaningful horizontal movement, and fail quickly if user is scrolling vertically.
      .activeOffsetX([-4, 4])
      .failOffsetY([-16, 16])
      .runOnJS(true)
      .onBegin((e) => emitFromX(e.x))
      .onUpdate((e) => emitFromX(e.x));

    const tap = Gesture.Tap()
      // More forgiving so slight finger drift doesn't cancel taps.
      .maxDistance(20)
      .runOnJS(true)
      .onStart((e) => emitFromX(e.x));

    // Prefer pan when it activates; otherwise allow taps.
    return Gesture.Exclusive(pan, tap);
  }, [emitFromX]);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        style={{
          height: Math.max(44, trackHeight + hitSlopPx * 2),
          justifyContent: 'center',
          paddingHorizontal: hitSlopPx,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          onLayout={onTrackLayout}
          style={{
            height: trackHeight,
            borderRadius: 999,
            backgroundColor: trackColor,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              height: '100%',
              width: filledPx,
              backgroundColor: fillColor,
              borderRadius: 999,
            }}
          />
        </View>

        {innerTrackWidth > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: hitSlopPx + filledPx - thumbSize / 2,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: '#FFFFFF',
              borderWidth: 2,
              borderColor: fillColor,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.15,
              shadowRadius: 4,
              elevation: 4,
            }}
          />
        ) : null}
      </View>
    </GestureDetector>
  );
}

