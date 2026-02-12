/**
 * Location Debug Page
 * 
 * Shows Google Timeline-like view for debugging location tracking:
 * - Today's location samples with activity type
 * - Detected segments (walking/driving/stationary)
 * - Place names with confidence scores
 * 
 * Created as part of Bug 1-5 fixes for timeline quality.
 */

import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, View, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, MapPin, Navigation, Car, Footprints, Bike, Home, Coffee, Building, CircleDot, Clock, AlertCircle, CheckCircle } from "lucide-react-native";
import { useAuthStore } from "@/stores";
import { Card, Icon } from "@/components/atoms";
import { fetchRecentLocationSamples, type LocationSampleRow } from "@/lib/supabase/services/location-samples";
import { fetchLocationHourlyForDay, type LocationHourlyRow } from "@/lib/supabase/services/evidence-data";
import { generateActivitySegments, type ActivitySegment } from "@/lib/supabase/services/activity-segments";
import { supabase } from "@/lib/supabase/client";

type LocationSample = LocationSampleRow;

// ============================================================================
// Activity Type Icons and Colors
// ============================================================================

const ACTIVITY_CONFIG: Record<string, { icon: typeof MapPin; color: string; label: string }> = {
  still: { icon: CircleDot, color: "#6B7280", label: "Stationary" },
  walking: { icon: Footprints, color: "#10B981", label: "Walking" },
  on_foot: { icon: Footprints, color: "#10B981", label: "On Foot" },
  running: { icon: Footprints, color: "#F59E0B", label: "Running" },
  on_bicycle: { icon: Bike, color: "#3B82F6", label: "Cycling" },
  in_vehicle: { icon: Car, color: "#8B5CF6", label: "Driving" },
  unknown: { icon: MapPin, color: "#9CA3AF", label: "Unknown" },
};

const PLACE_CONFIG: Record<string, { icon: typeof MapPin; color: string }> = {
  home: { icon: Home, color: "#10B981" },
  work: { icon: Building, color: "#3B82F6" },
  cafe: { icon: Coffee, color: "#F59E0B" },
  restaurant: { icon: Coffee, color: "#F59E0B" },
  default: { icon: MapPin, color: "#6B7280" },
};

function getActivityConfig(activityType: string | null | undefined) {
  return ACTIVITY_CONFIG[activityType || "unknown"] || ACTIVITY_CONFIG.unknown;
}

function getPlaceConfig(category: string | null | undefined) {
  return PLACE_CONFIG[category || "default"] || PLACE_CONFIG.default;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

function formatTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

function formatDistance(meters: number | null | undefined): string {
  if (!meters) return "";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function formatConfidence(score: number): { label: string; color: string } {
  if (score >= 0.7) return { label: "High", color: "#10B981" };
  if (score >= 0.5) return { label: "Medium", color: "#F59E0B" };
  if (score >= 0.3) return { label: "Low", color: "#EF4444" };
  return { label: "Very Low", color: "#9CA3AF" };
}

// ============================================================================
// Components
// ============================================================================

interface SampleCardProps {
  sample: LocationSample;
  index: number;
}

function SampleCard({ sample, index }: SampleCardProps) {
  // Extract activity from raw field
  const raw = sample.raw as any;
  const activityType = raw?.activity?.type || raw?.activity || null;
  const activityConfidence = raw?.activity?.confidence || null;
  const isMoving = raw?.is_moving;
  const event = raw?.event;
  
  const config = getActivityConfig(activityType);
  const ActivityIcon = config.icon;

  return (
    <View className="flex-row items-center py-2 border-b border-neutral-100">
      <View className="w-8 mr-2">
        <Text className="text-xs text-neutral-400">#{index + 1}</Text>
      </View>
      <View className="w-16 mr-3">
        <Text className="text-sm font-medium">{formatTime(sample.recorded_at)}</Text>
      </View>
      <View className="flex-1 flex-row items-center">
        <ActivityIcon size={14} color={config.color} />
        <Text className="ml-1 text-xs" style={{ color: config.color }}>
          {config.label}
          {activityConfidence ? ` (${activityConfidence}%)` : ""}
        </Text>
      </View>
      <View className="w-20">
        <Text className="text-xs text-neutral-500">
          {sample.accuracy_m ? `±${Math.round(sample.accuracy_m)}m` : ""}
        </Text>
      </View>
      <View className="w-16">
        <Text className="text-xs" style={{ color: isMoving ? "#10B981" : "#6B7280" }}>
          {isMoving ? "Moving" : "Still"}
        </Text>
      </View>
    </View>
  );
}

interface SegmentCardProps {
  segment: ActivitySegment;
  showDetails?: boolean;
}

function SegmentCard({ segment, showDetails = true }: SegmentCardProps) {
  const isCommute = segment.inferredActivity === "commute" || segment.placeCategory === "commute";
  const movementType = segment.movementType || "unknown";
  
  const activityConfig = isCommute
    ? getActivityConfig(movementType === "walking" ? "walking" : movementType === "cycling" ? "on_bicycle" : "in_vehicle")
    : getActivityConfig("still");
  
  const placeConfig = getPlaceConfig(segment.placeCategory);
  const confidence = formatConfidence(segment.activityConfidence);
  
  const durationMinutes = Math.round(
    (segment.endedAt.getTime() - segment.startedAt.getTime()) / 60000
  );

  return (
    <Card className="mb-3 p-3">
      {/* Header with time and type */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Clock size={14} color="#6B7280" />
          <Text className="ml-1 text-sm font-medium text-neutral-700">
            {formatTime(segment.startedAt)} - {formatTime(segment.endedAt)}
          </Text>
          <Text className="ml-2 text-xs text-neutral-500">
            ({formatDuration(durationMinutes)})
          </Text>
        </View>
        <View className="flex-row items-center px-2 py-1 rounded-full" style={{ backgroundColor: confidence.color + "20" }}>
          <Text className="text-xs font-medium" style={{ color: confidence.color }}>
            {confidence.label}
          </Text>
        </View>
      </View>

      {/* Location or Travel */}
      <View className="flex-row items-center">
        {isCommute ? (
          <>
            <activityConfig.icon size={18} color={activityConfig.color} />
            <View className="ml-2 flex-1">
              <Text className="font-semibold text-base" style={{ color: activityConfig.color }}>
                {activityConfig.label}
              </Text>
              {segment.distanceM && (
                <Text className="text-xs text-neutral-500">
                  {formatDistance(segment.distanceM)}
                </Text>
              )}
            </View>
          </>
        ) : (
          <>
            <placeConfig.icon size={18} color={placeConfig.color} />
            <View className="ml-2 flex-1">
              <Text className="font-semibold text-base">
                {segment.placeLabel || "Unknown Location"}
              </Text>
              {segment.placeCategory && (
                <Text className="text-xs text-neutral-500 capitalize">
                  {segment.placeCategory}
                </Text>
              )}
            </View>
          </>
        )}
      </View>

      {/* Details section */}
      {showDetails && (
        <View className="mt-3 pt-2 border-t border-neutral-100">
          <View className="flex-row flex-wrap">
            <View className="mr-4 mb-1">
              <Text className="text-xs text-neutral-400">Samples</Text>
              <Text className="text-sm font-medium">{segment.evidence.locationSamples}</Text>
            </View>
            <View className="mr-4 mb-1">
              <Text className="text-xs text-neutral-400">Confidence</Text>
              <Text className="text-sm font-medium">{(segment.activityConfidence * 100).toFixed(0)}%</Text>
            </View>
            {segment.placeDistanceM != null && (
              <View className="mr-4 mb-1">
                <Text className="text-xs text-neutral-400">Distance to Place</Text>
                <Text className="text-sm font-medium">{formatDistance(segment.placeDistanceM)}</Text>
              </View>
            )}
            {segment.placeConfidenceLevel && (
              <View className="mr-4 mb-1">
                <Text className="text-xs text-neutral-400">Place Confidence</Text>
                <Text className="text-sm font-medium capitalize">{segment.placeConfidenceLevel}</Text>
              </View>
            )}
          </View>
          {segment.locationLat && segment.locationLng && (
            <Text className="text-xs text-neutral-400 mt-1">
              📍 {segment.locationLat.toFixed(5)}, {segment.locationLng.toFixed(5)}
            </Text>
          )}
        </View>
      )}
    </Card>
  );
}

interface HourlyRowProps {
  row: LocationHourlyRow;
}

function HourlyRow({ row }: HourlyRowProps) {
  const hourStart = new Date(row.hour_start);
  const placeConfig = getPlaceConfig(row.place_category || undefined);
  const PlaceIcon = placeConfig.icon;

  return (
    <View className="flex-row items-center py-2 border-b border-neutral-100">
      <View className="w-16 mr-3">
        <Text className="text-sm font-medium">{formatTime(hourStart)}</Text>
      </View>
      <View className="flex-1 flex-row items-center">
        <PlaceIcon size={14} color={placeConfig.color} />
        <Text className="ml-1 text-sm flex-1" numberOfLines={1}>
          {row.google_place_name || row.place_label || row.geohash7 || "Unknown"}
        </Text>
      </View>
      <View className="w-16">
        <Text className="text-xs text-neutral-500">
          {row.sample_count} pts
        </Text>
      </View>
      <View className="w-16">
        <Text className="text-xs text-neutral-500">
          {row.avg_accuracy_m ? `±${Math.round(row.avg_accuracy_m)}m` : ""}
        </Text>
      </View>
    </View>
  );
}

// ============================================================================
// Main Screen
// ============================================================================

export default function LocationDebugScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [samples, setSamples] = useState<LocationSample[]>([]);
  const [segments, setSegments] = useState<ActivitySegment[]>([]);
  const [hourlyData, setHourlyData] = useState<LocationHourlyRow[]>([]);
  
  const [activeTab, setActiveTab] = useState<"timeline" | "samples" | "hourly">("timeline");

  // Filter to today's data
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todaySamples = useMemo(() => {
    return samples.filter((s) => new Date(s.recorded_at).getTime() >= todayStart.getTime());
  }, [samples, todayStart]);

  // Activity type breakdown
  const activityBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    for (const sample of todaySamples) {
      const raw = sample.raw as any;
      const activityType = raw?.activity?.type || raw?.activity || "unknown";
      breakdown[activityType] = (breakdown[activityType] || 0) + 1;
    }
    return breakdown;
  }, [todaySamples]);

  // Helper to format date as YYYY-MM-DD
  const formatYmd = (date: Date): string => {
    return date.toISOString().slice(0, 10);
  };

  // Load data
  const loadData = useCallback(async () => {
    if (!userId) return;
    
    setError(null);
    try {
      // Fetch remote samples
      const remoteSamples = await fetchRecentLocationSamples(userId, { limit: 500 });
      setSamples(remoteSamples);
      
      // Fetch hourly data (expects YMD string)
      const todayYmd = formatYmd(todayStart);
      const hourly = await fetchLocationHourlyForDay(userId, todayYmd);
      setHourlyData(hourly);
      
      // Generate segments for each hour of today
      const allSegments: ActivitySegment[] = [];
      const currentHour = new Date();
      const startHour = new Date(todayStart);
      
      // Generate segments for each hour from midnight to current hour
      while (startHour <= currentHour) {
        try {
          const hourSegments = await generateActivitySegments(userId, new Date(startHour));
          allSegments.push(...hourSegments);
        } catch (err) {
          // Skip hours with no data
        }
        startHour.setHours(startHour.getHours() + 1);
      }
      
      // Dedupe segments by ID
      const uniqueSegments = Array.from(
        new Map(allSegments.map(s => [s.id, s])).values()
      );
      setSegments(uniqueSegments);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load location data");
    }
  }, [userId, todayStart]);

  useEffect(() => {
    setIsLoading(true);
    loadData().finally(() => setIsLoading(false));
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!userId) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-neutral-500">Not authenticated</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-neutral-50" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View className="px-4 py-3 bg-white border-b border-neutral-200">
        <View className="flex-row items-center">
          <Pressable onPress={() => router.back()} className="mr-3 p-1">
            <ArrowLeft size={24} color="#374151" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-bold text-neutral-800">Location Debug</Text>
            <Text className="text-xs text-neutral-500">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats Bar */}
      <View className="px-4 py-3 bg-white border-b border-neutral-200">
        <View className="flex-row justify-between">
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-neutral-800">{todaySamples.length}</Text>
            <Text className="text-xs text-neutral-500">Samples</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-neutral-800">{segments.length}</Text>
            <Text className="text-xs text-neutral-500">Segments</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-xl font-bold text-neutral-800">{hourlyData.length}</Text>
            <Text className="text-xs text-neutral-500">Hours</Text>
          </View>
        </View>
        
        {/* Activity breakdown */}
        {Object.keys(activityBreakdown).length > 0 && (
          <View className="flex-row flex-wrap mt-2 pt-2 border-t border-neutral-100">
            {Object.entries(activityBreakdown).map(([type, count]) => {
              const config = getActivityConfig(type);
              return (
                <View key={type} className="flex-row items-center mr-3 mb-1">
                  <config.icon size={12} color={config.color} />
                  <Text className="text-xs ml-1" style={{ color: config.color }}>
                    {config.label}: {count}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Tab Bar */}
      <View className="flex-row bg-white border-b border-neutral-200">
        <Pressable
          className={`flex-1 py-3 items-center ${activeTab === "timeline" ? "border-b-2 border-blue-500" : ""}`}
          onPress={() => setActiveTab("timeline")}
        >
          <Text className={`font-medium ${activeTab === "timeline" ? "text-blue-600" : "text-neutral-500"}`}>
            Timeline
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-3 items-center ${activeTab === "samples" ? "border-b-2 border-blue-500" : ""}`}
          onPress={() => setActiveTab("samples")}
        >
          <Text className={`font-medium ${activeTab === "samples" ? "text-blue-600" : "text-neutral-500"}`}>
            Samples
          </Text>
        </Pressable>
        <Pressable
          className={`flex-1 py-3 items-center ${activeTab === "hourly" ? "border-b-2 border-blue-500" : ""}`}
          onPress={() => setActiveTab("hourly")}
        >
          <Text className={`font-medium ${activeTab === "hourly" ? "text-blue-600" : "text-neutral-500"}`}>
            Hourly
          </Text>
        </Pressable>
      </View>

      {/* Error Banner */}
      {error && (
        <View className="px-4 py-2 bg-red-50">
          <View className="flex-row items-center">
            <AlertCircle size={16} color="#EF4444" />
            <Text className="ml-2 text-sm text-red-600">{error}</Text>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View className="items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="mt-2 text-neutral-500">Loading location data...</Text>
          </View>
        ) : (
          <>
            {/* Timeline Tab - Shows segments like Google Timeline */}
            {activeTab === "timeline" && (
              <View className="px-4 pt-4">
                {segments.length === 0 ? (
                  <View className="items-center py-10">
                    <MapPin size={40} color="#9CA3AF" />
                    <Text className="mt-2 text-neutral-500">No segments detected yet</Text>
                    <Text className="text-xs text-neutral-400 mt-1">
                      Keep moving to generate timeline data
                    </Text>
                  </View>
                ) : (
                  segments
                    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
                    .map((segment) => (
                      <SegmentCard key={segment.id} segment={segment} />
                    ))
                )}
              </View>
            )}

            {/* Samples Tab - Shows raw location samples */}
            {activeTab === "samples" && (
              <View className="px-4 pt-4">
                <Card className="p-3">
                  <Text className="text-sm font-medium text-neutral-700 mb-2">
                    Recent Location Samples
                  </Text>
                  {todaySamples.length === 0 ? (
                    <Text className="text-neutral-400 text-center py-4">
                      No samples collected today
                    </Text>
                  ) : (
                    todaySamples
                      .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
                      .slice(0, 50)
                      .map((sample, index) => (
                        <SampleCard key={sample.dedupe_key || index} sample={sample} index={index} />
                      ))
                  )}
                </Card>
              </View>
            )}

            {/* Hourly Tab - Shows hourly aggregation */}
            {activeTab === "hourly" && (
              <View className="px-4 pt-4">
                <Card className="p-3">
                  <Text className="text-sm font-medium text-neutral-700 mb-2">
                    Hourly Location Summary
                  </Text>
                  {hourlyData.length === 0 ? (
                    <Text className="text-neutral-400 text-center py-4">
                      No hourly data available
                    </Text>
                  ) : (
                    hourlyData
                      .sort((a, b) => new Date(a.hour_start).getTime() - new Date(b.hour_start).getTime())
                      .map((row, index) => (
                        <HourlyRow key={`${row.hour_start}-${index}`} row={row} />
                      ))
                  )}
                </Card>
              </View>
            )}

            {/* Debug Info Section */}
            <View className="px-4 pt-6 pb-4">
              <Card className="p-3">
                <Text className="text-sm font-medium text-neutral-700 mb-2">
                  🐛 Debug Info
                </Text>
                <View className="space-y-1">
                  <Text className="text-xs text-neutral-500">
                    Platform: {Platform.OS}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Transistor Enabled: {process.env.EXPO_PUBLIC_USE_TRANSISTOR_LOCATION === "true" ? "Yes" : "No"}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Distance Filter: 15m (optimized for walking)
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Activity Detection: Enabled
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Place Search Radius: 150m (max 200m)
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Confident Distance: 50m
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    Fuzzy Distance: 100m
                  </Text>
                </View>
              </Card>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
