# Location Editing - Testing Checklist

Quick checklist for Cole to verify all fixes are working.

---

## ✅ Test #1: Click Detection (2 min)

**Task:** Tap location banners to open edit modal

- [ ] Tap a banner → modal opens immediately
- [ ] Tap another banner → modal opens
- [ ] Tap rapidly 5 times on different banners → all open
- [ ] Try tapping while slowly scrolling → still works
- [ ] Banner scales slightly when pressed (visual feedback)

**Pass Criteria:** 100% tap success rate, clear visual feedback

---

## ✅ Test #2: Label Persistence (3 min)

**Task:** Save a location label and verify it persists

### Save Flow:
1. [ ] Tap a banner (e.g., "Unknown Location")
2. [ ] Change label to "Test Home"
3. [ ] Select category: "Home"
4. [ ] Set radius: "Medium (100m)"
5. [ ] Tap "Save"
6. [ ] Modal closes
7. [ ] Timeline refreshes automatically
8. [ ] **Block now shows "Test Home"** ← KEY CHECK

### Persistence Check:
9. [ ] Pull to refresh → label still "Test Home"
10. [ ] Navigate away and back → label still "Test Home"
11. [ ] Close app completely and reopen → label still "Test Home"

**Pass Criteria:** Label appears immediately after save, persists forever

---

## ✅ Test #3: Visual Affordance (1 min)

**Task:** Verify you can tell banners are tappable

- [ ] Chevron (›) visible on right side of banner
- [ ] Chevron has subtle pulse animation
- [ ] Banner has slight shadow (looks clickable)
- [ ] When pressing: banner scales down smoothly
- [ ] Animation feels natural (not jarring)

**Pass Criteria:** Clear visual hint that banner is interactive

---

## 🐛 If Something Fails

### Clicks not working?
- Check React Native console for: `[ActivityTimeline] Banner pressed: ...`
- If missing → touch handler issue
- If present → modal state issue

### Labels not showing?
- Check console for: `[LocationBlockList] Loaded user labels: X places`
- If 0 → no saved labels yet (try saving one)
- If > 0 but not showing → priority logic issue

### Labels reverting?
- Check console for: `[ActivityTimeline] Location label saved, refreshing...`
- If missing → save failed (check for error alert)
- If present → refresh issue

---

## ✅ All Tests Passed

If all checkboxes are checked, the fix is complete! 🎉

---

**Note:** Run tests on Cole's account with real activity data for most accurate results.
