# Location Carry-Forward V3 - Required Fixes

## Issues Found in V2 Implementation

### 1. Case-Insensitive Location Filtering

**Current (Bug):**
```typescript
const meaninglessLabels = [
  'Unknown Location',
  'Unknown',
  'Location',
  'In Transit',
];

return !meaninglessLabels.includes(block.locationLabel);
```

**Fixed:**
```typescript
const meaninglessLabels = [
  'unknown location',
  'unknown',
  'location',
  'in transit',
];

return !meaninglessLabels.includes(block.locationLabel.trim().toLowerCase());
```

---

### 2. Case-Insensitive Location Change Detection

**Current (Bug):**
```typescript
nextBlock.locationLabel !== currentBlock.locationLabel
```

**Fixed:**
```typescript
nextBlock.locationLabel.trim().toLowerCase() !== currentBlock.locationLabel.trim().toLowerCase()
```

---

### 3. Re-Check Minimum Gap After Buffer

**Current (Bug):**
```typescript
if (nextBlock.type === "travel") {
  const bufferMs = 30 * 60 * 1000;
  adjustedGapEnd = new Date(gapEnd.getTime() - bufferMs);
  
  if (adjustedGapEnd.getTime() <= gapStart.getTime()) {
    continue;
  }
}
```

**Fixed:**
```typescript
if (nextBlock.type === "travel") {
  const bufferMs = 30 * 60 * 1000;
  adjustedGapEnd = new Date(gapEnd.getTime() - bufferMs);
  
  const adjustedGapDurationMs = adjustedGapEnd.getTime() - gapStart.getTime();
  if (adjustedGapDurationMs < MIN_GAP_FOR_CARRY_FORWARD_MS) {
    continue; // Gap too small after buffer
  }
}
```

---

## Test Cases to Verify After Fixes

1. **Case variation:** "Home" → gap → "home" (should carry forward)
2. **Buffer edge case:** 31min gap before travel (should NOT create 1min block)
3. **Whitespace:** "Unknown Location " (should be filtered)
4. **Lowercase unknown:** "unknown" (should be filtered)

---

## Estimated Impact

- **Severity:** HIGH (data quality issues in production)
- **Risk:** Users with inconsistent location labels won't get gaps filled
- **Effort:** LOW (3 small code changes)
