# Timeline UX Research: World-Class Activity Tracking Apps

**Research Date:** February 9, 2026  
**Goal:** Match or exceed Google Timeline quality in TodayMatters

---

## Executive Summary

After analyzing Google Timeline, Arc App, Life360, Gyroscope, and the pioneering Moves app, several clear patterns emerge for world-class timeline UX. The "gold standard" feeling of Google Timeline comes from three core principles:

1. **Intelligent segmentation** that respects natural human activity patterns
2. **Confident place naming** that prioritizes meaningful names over raw addresses
3. **Visual hierarchy** that emphasizes what matters (places) over transitions

---

## 1. Segmentation Patterns

### Google Timeline Approach (The Gold Standard)
- **Sequential clustering algorithm**: Groups nearby points in temporal sequence as a single "stay"
- **Not just spatial clustering**: Order and time gaps matter as much as distance
- Considers sequences of nearby points as staying in one location
- Points between stay sequences = movement/transition segments
- Minimum stay duration appears to be ~5 minutes for location establishment

### Arc App
- Automatic detection runs in background at regular intervals
- Uses machine learning to classify activities: walking, running, driving, cycling
- Provides manual override for 16+ activity types
- Day/Week/Month aggregate views with full map support
- Notes and photos can be attached to trips

### Industry Pattern
**Best practice for TodayMatters:**
- **Minimum segment duration**: 5-7 minutes to qualify as a "place visit"
- **Transition threshold**: Stops under 5 minutes should be treated as waypoints/transitions, not destinations
- **Clustering approach**: Sequential temporal clustering beats pure spatial clustering
- **Merge logic**: Combine segments at same location if separated by <30 minutes

### Implementation Recommendation
```javascript
// Pseudo-logic for segmentation
if (stayDuration >= 5 minutes && movementSpeed < walkingThreshold) {
  createPlaceSegment()
} else if (stayDuration < 5 minutes) {
  treatAsWaypoint() // Gas station, red light, brief stop
} else {
  createTransitSegment()
}

// Merge logic
if (location1 === location2 && timeBetween < 30 minutes) {
  mergeSegments()
}
```

---

## 2. Place Resolution (The Critical UX Differentiator)

### Google Timeline Strategy
**Hierarchical naming priority:**
1. **Business/POI name** (e.g., "Starbucks", "Central Park")
2. **Generic category** (e.g., "Restaurant", "Park") 
3. **Street address** (e.g., "123 Main St")
4. **Neighborhood/area** (e.g., "Downtown Austin")
5. **"Unknown Location"** (last resort)

**Key insight**: Google aggressively reverse-geocodes to find business names via Places API

### Life360 Approach
- Uses "Trusted Places" concept (home, work, school)
- Shows business names for commercial locations
- Falls back to address for residential areas
- Displays place name prominently in timeline cards

### Arc App
- "Search Locations" feature suggests they maintain a database of visited places
- Place naming appears to be learned over time
- Allows manual naming/tagging of locations

### Gyroscope
- Emphasizes beautiful data visualization over raw accuracy
- Groups places into categories (shops, airports, restaurants)
- Shows time spent at different place types
- Dashboard/timeline hybrid with heavy visual polish

### Why This Matters
Users think in **place names**, not coordinates. "Coffee shop on 5th" beats "30.2672° N, 97.7431° W"

### Implementation Recommendation for TodayMatters
```
Priority ladder:
1. User-labeled places (highest priority)
   → "Home", "Mom's House", "Favorite Coffee Shop"
   
2. Reverse geocoded business names
   → Query Google Places/Overpass for POI at coordinates
   → Show: "Whole Foods Market"
   
3. Category from business type
   → If name unavailable: "Grocery Store"
   
4. Street address (readable format)
   → "2525 W Anderson Ln"
   → NOT raw coordinates
   
5. Neighborhood/City
   → "North Loop, Austin"
   
6. "Unknown Location" (avoid if possible)
   → Only when reverse geocoding completely fails
```

**Cache strategy**: Store reverse-geocoded names locally to avoid API spam and ensure offline functionality.

---

## 3. Transport Mode Detection

### Google Timeline
Detects and displays:
- **Walking** 🚶
- **Biking** 🚴
- **Driving** 🚗
- **Public transit** 🚌
- **Flying** ✈️

**Visual treatment:**
- Uses distinct icons for each mode
- Shows mode in segment cards
- Timeline Insights tab shows monthly breakdown by transport mode
- Bar graphs showing distance/time per mode

### Arc App - The Most Sophisticated
Detects automatically:
- Walking, Running (ON_FOOT subcategories)
- Driving (IN_VEHICLE)
- Cycling (ON_BICYCLE)
- Still, Tilting (phone states)
- **Plus 16 manual activity types**

**Confidence-based approach:**
- Android Activity Recognition API returns confidence % (0-100)
- Typical threshold: **70-75% confidence** to display activity
- Multiple probable activities returned, highest confidence wins

### Life360
- Focuses on driving detection for family safety
- Shows drive history with routes
- "Small purple map icon" for detailed trip view
- Less granular than Arc/Google (primarily car vs. stationary)

### Moves App (Historical Influence)
- Pioneered automatic activity detection
- Binary classification: moving vs. stationary
- Simple, clean activity cards

### Visual Language - Icons & Colors

**Industry standard transport icons:**
- 🚶 Walking: Person walking icon, often blue/teal
- 🚴 Cycling: Bicycle icon, green
- 🚗 Driving: Car icon, orange/red
- 🚌 Transit: Bus icon, purple
- ✈️ Flying: Plane icon, blue

**Color psychology:**
- Blue/teal = walking (calm, slower)
- Orange/red = driving (faster, attention)
- Green = cycling (eco-friendly, moderate speed)

### Implementation Recommendation for TodayMatters
```javascript
// Confidence thresholds (from research)
const ACTIVITY_CONFIDENCE_THRESHOLD = 70; // minimum to display
const HIGH_CONFIDENCE = 85; // show with emphasis

// Speed-based fallback detection
speedThresholds = {
  still: 0-2 mph,
  walking: 2-5 mph,
  running: 5-12 mph,
  cycling: 12-20 mph,
  driving: 20+ mph
}

// Visual treatment
activityIcons = {
  walking: '🚶',
  running: '🏃',
  cycling: '🚴',
  driving: '🚗',
  transit: '🚌'
}

// Show confidence if < 85%
if (confidence < 85) {
  displayConfidenceIndicator(); // e.g., "Probably driving"
}
```

---

## 4. Timeline UX - Visual Rendering

### Google Timeline (Mobile)
**Layout:**
- **Vertical scrolling list** of day's activities
- **Card-based design** for each segment
- Each card shows:
  - Place name/address (bold, large)
  - Arrival/departure times
  - Duration
  - Small map thumbnail
  - Transport mode icon
- **Top navigation**: Calendar picker for date selection
- **Tabs**: Timeline | Insights | Trips
- **Insights tab**: Monthly stats with bar graphs (transport breakdown, distance traveled, time at place types)

**Interaction patterns:**
- Tap card → expand to full map + details
- Swipe up/down to navigate timeline
- Pull-to-refresh for updates

### Arc App
**Layout:**
- **Day/Week/Month views** (flexible zoom levels)
- **Full map mode** available
- Timeline shows movement paths on map
- **Cards overlay map** for segment details
- Search locations feature for filtering
- Attach notes & photos to segments

**Key difference**: Map-first vs. list-first (Google uses list-first)

### Life360
**Layout:**
- **Member-centric** (select family member, then view their timeline)
- "Daily History" shows overview map with location dots
- Dots indicate app location updates
- **7 days of history** (Basic Timeline feature)
- Purple map icon for detailed drive view

**Focus**: Real-time location + recent history, not deep historical analysis

### Gyroscope
**Layout:**
- **Dashboard approach** with timeline component
- Heavy visual emphasis (data visualization)
- Aggregates across data sources (not just location)
- Beautiful charts and graphs
- More "life tracking" than pure location timeline

### Moves (Historical)
**Layout:**
- **Simple vertical timeline**
- Alternating place/activity cards
- Minimal chrome, content-focused
- Clean iconography
- Influenced all modern timeline apps

### Design Pattern Analysis

**List View Advantages:**
- Easy sorting/filtering
- Space efficient
- Fast scanning
- Better for text-heavy content
- Google's choice for Timeline

**Card View Advantages:**
- Visual grouping
- Engaging presentation
- Better for mixed content (images + text)
- Clearer hierarchy

**Map View Advantages:**
- Spatial context
- Route visualization
- Geographic understanding
- Better for exploring

### Implementation Recommendation for TodayMatters

**Primary view: Hybrid List + Mini Maps**
```
┌─────────────────────────────────┐
│  📅 Today                    ⚙️ │
├─────────────────────────────────┤
│                                 │
│  🏠 Home                        │
│  8:00 AM - 9:15 AM (1h 15m)    │
│  [mini map thumbnail]           │
│                                 │
│  🚗 15 min drive                │
│                                 │
│  ☕ Starbucks                   │
│  9:30 AM - 10:00 AM (30m)      │
│  [mini map thumbnail]           │
│                                 │
│  🚶 8 min walk                  │
│                                 │
│  🏢 Office                      │
│  10:08 AM - 5:30 PM (7h 22m)   │
│  [mini map thumbnail]           │
│                                 │
└─────────────────────────────────┘
```

**Secondary views:**
- **Map mode**: Full-screen map with route + pins
- **Stats mode**: Gyroscope-style insights (monthly/weekly aggregates)
- **Calendar mode**: Month view with daily summaries

**Progressive disclosure:**
- Tap segment card → expand for full details
- Tap mini map → full map view
- Long press → edit/correct segment

---

## 5. Confidence Handling

### Google Timeline
- **Doesn't explicitly show confidence levels** to users
- Under the hood: uses confidence to auto-correct activities
- "Edit" option available for all segments (implicit acknowledgment of uncertainty)
- Shows "?" icon occasionally for uncertain locations

### Arc App - Most Transparent
- Uses **Android Activity Recognition API**
- Returns confidence percentage (0-100) for each activity
- **70-75% minimum threshold** to display activity
- Higher confidence (>85%) = show without qualifier
- Lower confidence (70-85%) = show with "Probably" or "Might be" language

**Example from research:**
```
if (confidence > 75) {
  label = "Walking"
} else if (confidence > 50) {
  label = "Probably Walking" 
} else {
  label = "Unknown Activity"
}
```

### Life360
- No visible confidence indicators
- Focuses on accuracy through frequent updates
- Trade-off: more battery drain for higher certainty

### Industry Best Practice
**Don't hide uncertainty, but don't overwhelm:**
- Show confidence visually (e.g., faded icon for low confidence)
- Use natural language: "Probably driving", "Might be walking"
- Always allow manual correction
- Learn from corrections to improve future detection

### Implementation Recommendation for TodayMatters

```javascript
// Confidence tiers
TIER_1: 85-100% → Show definitive ("Driving")
TIER_2: 70-84%  → Show qualified ("Probably driving")
TIER_3: 50-69%  → Show uncertain ("Unknown - tap to classify")
TIER_4: <50%    → Don't auto-label, prompt for input

// Visual indicators
HIGH_CONFIDENCE: Solid icon, normal opacity
MED_CONFIDENCE: Solid icon, 70% opacity + "Probably" text
LOW_CONFIDENCE: Outline icon, 50% opacity + "?" badge
```

**User control is critical:**
- Every segment should be editable
- Quick-tap to cycle through common activities
- "Learn from this" checkbox to improve future detection
- Manual corrections feed back into confidence algorithm

---

## 6. Short Visits vs. Long Stays

### The Problem
How do you handle:
- **5-minute gas station stop** (waypoint, not destination)
- **2-hour restaurant lunch** (destination, very relevant)
- **30-second red light** (noise, ignore)

### Google Timeline Solution
**Tiered duration thresholds:**
- **<3 minutes**: Likely noise/red light, filter out
- **3-5 minutes**: Waypoint/brief stop, show in route but don't emphasize
- **5-15 minutes**: Short visit (e.g., pickup, ATM), show as minor card
- **15+ minutes**: Significant visit, show as major card with full details
- **1+ hour**: Major stay, highlight prominently

**Visual treatment differences:**
- Short visits: Smaller cards, less detail
- Long stays: Larger cards, more context (photos, notes)
- Waypoints: Dots on route line, not separate cards

### Arc App
- Combines short segments into "trips"
- Shows route with stops as small markers
- Only promotes stops to full segments if >10 minutes

### Life360
- Focuses on "Daily History" overview
- Shows movement dots on map
- Less granular for short stops (family tracking use case)

### Implementation Recommendation for TodayMatters

**Duration-based hierarchy:**

```javascript
// Segment classification
NOISE: 0-2 min → Filter out (red lights, GPS drift)
WAYPOINT: 2-5 min → Show on route, no card (gas, drive-through)
SHORT_VISIT: 5-15 min → Small card (quick errands)
VISIT: 15-60 min → Standard card (coffee, shopping)
STAY: 60+ min → Emphasized card (work, dinner, home)

// Visual treatment
renderSegment(duration, type) {
  if (duration < 2) return null; // filter noise
  
  if (duration < 5) {
    // Waypoint: dot on route line
    return <RouteMarker size="small" />;
  }
  
  if (duration < 15) {
    // Short visit: compact card
    return <CompactCard 
      size="small"
      showMap={false}
      showDetails="collapsed"
    />;
  }
  
  if (duration < 60) {
    // Visit: standard card
    return <StandardCard 
      size="medium"
      showMap={true}
      showDetails="summary"
    />;
  }
  
  // Stay: expanded card
  return <ExpandedCard 
    size="large"
    showMap={true}
    showDetails="full"
    allowNotes={true}
  />;
}
```

**Smart exceptions:**
- Recognize place type: Coffee shop (expect 15-45 min), Office (expect hours)
- User patterns: If user regularly stops at gas station for 4 minutes, learn that it's a waypoint
- Context: Stop during longer drive = waypoint; Stop as only activity = visit

---

## 7. Transitions (The Gaps Between Places)

### Google Timeline Approach
**Movement segments get their own cards:**
- Show transport mode icon
- Show duration
- Show distance (e.g., "2.3 miles")
- Show route on mini-map
- Expandable to full route view

**Visual connector:**
- Vertical timeline line connects place cards
- Movement segments are thinner cards between place cards
- Clear visual hierarchy: **Places > Movements**

### Arc App
- Shows full route on map
- Movement paths are lines with activity type
- Can show speed/altitude graphs for routes
- Notes attachable to trips

### Life360
- Route shown on map for drives
- Less emphasis on movement details
- Focus on "where" not "how"

### Design Pattern
**The key insight:** Transitions are **connective tissue**, not the main story.

Users care more about:
1. **Where** they went (places)
2. **When** they were there
3. **How long** they stayed
4. *Then* how they got there

### Implementation Recommendation for TodayMatters

**Visual hierarchy:**
```
┌────────────────────────────────┐
│  ☕ Starbucks                  │ ← LARGE card (place)
│  9:30 AM - 10:00 AM (30m)     │
│  [map thumbnail]               │
└────────────────────────────────┘
         │
    🚶 8 min walk                  ← SMALL inline (transition)
         │
┌────────────────────────────────┐
│  🏢 Office                     │ ← LARGE card (place)
│  10:08 AM - 5:30 PM (7h 22m)  │
│  [map thumbnail]               │
└────────────────────────────────┘
```

**Interaction design:**
- Transitions: Non-interactive by default, tap to expand route
- Places: Interactive by default, tap for details
- Timeline spine: Vertical line connects all segments
- Time markers: Show on the spine for quick scanning

**Progressive detail:**
```
Default view:
  🚗 15 min drive

Tap to expand:
  🚗 15 min drive (8.2 miles)
  via Highway 183
  [route map]
  Departed: 9:15 AM
  Arrived: 9:30 AM
  Avg speed: 33 mph
```

---

## What Makes Google Timeline Feel "Right"

After analyzing all competitors, Google Timeline's superiority comes from:

### 1. **Intelligent Defaults**
- Aggressive place name resolution (not lazy geocoding)
- Smart duration thresholds filter noise
- Conservative confidence levels (fewer false positives)

### 2. **Visual Clarity**
- Clear hierarchy: Places matter most
- Consistent iconography
- Good use of whitespace
- Mini-maps provide context without overwhelming

### 3. **Trust Through Transparency**
- Everything is editable
- Shows "what we think" without hiding uncertainty
- Timeline Insights provide meta-analysis (monthly trends)

### 4. **Performance**
- Fast loading (even with years of data)
- Smooth scrolling
- Instant date switching

### 5. **Context, Not Just Data**
- Shows photos taken at locations (if available)
- Integrates with Google Photos
- "Trips" feature aggregates related days

### 6. **Privacy Control**
- Timeline is private by default
- Easy to delete segments or entire days
- Location history can be paused

---

## Specific Recommendations for TodayMatters

### Immediate Priorities (Match Google Baseline)

1. **Fix Place Naming (CRITICAL)**
   - Implement reverse geocoding with Google Places API
   - Cache results locally
   - Fallback hierarchy: POI name → Category → Address → Neighborhood
   - Never show raw coordinates to users

2. **Segmentation Tuning**
   - 5-minute minimum for place visits
   - <3 minutes = filter as noise
   - 3-5 minutes = waypoints (show on route, no card)
   - Implement sequential temporal clustering

3. **Visual Hierarchy**
   - Card-based timeline (vertical scroll)
   - Large cards for places (1h+)
   - Small cards for visits (15-60 min)
   - Inline labels for transitions
   - Mini-maps on all place cards

4. **Transport Mode Icons**
   - Use standard emoji or custom icons
   - 🚶 Walking (blue)
   - 🚴 Cycling (green)
   - 🚗 Driving (orange)
   - 🚌 Transit (purple)

5. **Confidence Handling**
   - Show "Probably X" for 70-84% confidence
   - Allow easy manual correction
   - Learn from corrections

### Features to Beat Google

1. **Smarter Short Visit Handling**
   - Learn user patterns (e.g., "This is my usual gas station, it's always a waypoint")
   - Combine with place type (grocery store = 30-60 min expected)

2. **Better Timeline Navigation**
   - Week/Month views (not just day)
   - Quick jump to "interesting days" (high activity)
   - Search locations: "Show all Starbucks visits"

3. **Activity Insights (Gyroscope-style)**
   - "You spent 8 hours at office this week (down 3 hours from last week)"
   - "You drove 45 miles less this month"
   - Beautiful charts for nerds

4. **Social Context (Life360-style, but privacy-respecting)**
   - Share specific days/trips (not live location)
   - "I was here" check-ins
   - Trip summaries for sharing

5. **Offline-First**
   - Google Timeline works poorly offline
   - Cache all place names locally
   - Offline editing, sync when connected

6. **Better Unknown Location Handling**
   - Never show "Unknown Location" if address is available
   - Prompt: "Where were you?" with nearby place suggestions
   - Learn from manual labels

### UI/UX Best Practices Summary

✅ **DO:**
- Use cards for places, inline labels for transitions
- Show mini-maps for spatial context
- Implement progressive disclosure (tap to expand)
- Use consistent, recognizable icons
- Make everything editable
- Cache aggressively for offline use
- Show confidence levels for uncertain data
- Filter noise (<3 min stops)
- Prioritize business names over addresses

❌ **DON'T:**
- Show raw coordinates ever
- Clutter timeline with every GPS ping
- Hide uncertainty from users
- Make transitions the visual focus
- Use inconsistent iconography
- Require internet for basic viewing
- Auto-label with low confidence (<70%)
- Make editing hard

---

## Competitive Positioning

| Feature | Google Timeline | Arc App | Life360 | Gyroscope | **TodayMatters Goal** |
|---------|----------------|---------|---------|-----------|----------------------|
| **Automatic Detection** | ★★★★☆ | ★★★★★ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| **Place Naming** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★☆☆ | ★★★★★ |
| **Timeline UX** | ★★★★★ | ★★★★☆ | ★★★☆☆ | ★★★★★ | ★★★★★ |
| **Offline Support** | ★★☆☆☆ | ★★★☆☆ | ★☆☆☆☆ | ★☆☆☆☆ | ★★★★★ |
| **Privacy** | ★★★☆☆ | ★★★★☆ | ★☆☆☆☆ | ★★☆☆☆ | ★★★★★ |
| **Insights/Stats** | ★★★★☆ | ★★★☆☆ | ★★☆☆☆ | ★★★★★ | ★★★★★ |
| **Transport Modes** | ★★★★☆ | ★★★★★ | ★★☆☆☆ | ★★★☆☆ | ★★★★★ |
| **Social Features** | ★☆☆☆☆ | ★☆☆☆☆ | ★★★★★ | ★★☆☆☆ | ★★★☆☆ |

**Our differentiation:**
- **Privacy-first** (local storage, no cloud by default)
- **Offline-first** (works without internet)
- **Smarter segmentation** (learn user patterns)
- **Beautiful insights** (Gyroscope-level polish)
- **Google-level accuracy** (Arc-level detection)

---

## Technical Implementation Checklist

### Phase 1: Core Timeline (Match Google)
- [ ] Sequential temporal clustering algorithm
- [ ] Duration-based segment classification (<3m=noise, 5m=waypoint, etc.)
- [ ] Reverse geocoding with Google Places API
- [ ] Place name caching (SQLite)
- [ ] Card-based vertical timeline UI
- [ ] Mini-map thumbnails
- [ ] Transport mode detection (use device sensors + speed)
- [ ] Basic edit functionality

### Phase 2: Polish (Match Arc)
- [ ] Confidence-based activity detection
- [ ] Manual activity type override
- [ ] Week/Month timeline views
- [ ] Full-screen map mode
- [ ] Photo attachment to segments
- [ ] Notes on places
- [ ] Search/filter locations

### Phase 3: Insights (Beat Everyone)
- [ ] Monthly transport mode breakdown
- [ ] Time at place categories (work, home, social)
- [ ] Weekly comparison ("3h less at office than last week")
- [ ] Beautiful charts (Gyroscope-style)
- [ ] Interesting day detection ("You had an unusual day!")
- [ ] Location pattern learning

### Phase 4: Advanced
- [ ] Trip detection and grouping
- [ ] Vacation/travel mode
- [ ] Share trip summaries
- [ ] Export data (multiple formats)
- [ ] Advanced privacy controls
- [ ] Battery optimization

---

## Conclusion: The Formula for Excellence

**World-class timeline UX = Smart Segmentation + Confident Naming + Visual Clarity**

The research shows that users don't want raw data—they want **story**. Your timeline should tell the story of their day in human terms:

> "You spent the morning at home, drove to Starbucks for a quick coffee, walked to the office where you worked for 7 hours, then drove home."

Not:

> "You were stationary at 30.2672° N from 08:00-09:15, then moved in a vehicle for 15 minutes to 30.2845° N..."

**Implement the fundamentals first** (segmentation, naming, visual hierarchy), **then add delight** (insights, beautiful charts, smart learning). Google Timeline wins because it gets the basics perfect. We can beat them by adding the polish of Gyroscope and the detection smarts of Arc, while respecting privacy better than either.

Ship it. 🚀

---

**Next Steps:**
1. Review this doc with the team
2. Create detailed design mockups based on recommendations
3. Build proof-of-concept with improved segmentation
4. Test with real user data
5. Iterate based on feedback

**Questions/Feedback:** Discuss in #todaymatters-dev
