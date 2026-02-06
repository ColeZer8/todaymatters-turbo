/**
 * Shared place icon and color utilities.
 *
 * Extracted from HourlySummaryCard so both the legacy card and the new
 * LocationBlockCard can share the same mapping logic.
 */

import {
  MapPin,
  Home,
  Briefcase,
  Dumbbell,
  Coffee,
  Car,
  ShoppingBag,
  Utensils,
  Building2,
  Church,
  GraduationCap,
  Heart,
  type LucideIcon,
} from "lucide-react-native";

import type { LocationBlock } from "@/lib/types/location-block";
import { LOCATION_COLORS, type LocationBannerColors } from "@/lib/types/timeline-event";

/**
 * Get an icon for a place category based on label text.
 */
export function getPlaceIcon(placeLabel: string | null): LucideIcon {
  if (!placeLabel) return MapPin;

  const label = placeLabel.toLowerCase();

  if (label.includes("home")) return Home;
  if (label.includes("office") || label.includes("work")) return Briefcase;
  if (label.includes("gym") || label.includes("fitness")) return Dumbbell;
  if (label.includes("cafe") || label.includes("coffee")) return Coffee;
  if (label.includes("commute") || label.includes("transit") || label.includes("travel")) return Car;
  if (label.includes("store") || label.includes("shop")) return ShoppingBag;
  if (label.includes("restaurant") || label.includes("food")) return Utensils;
  if (label.includes("church")) return Church;
  if (label.includes("school") || label.includes("university")) return GraduationCap;
  if (label.includes("hospital") || label.includes("doctor")) return Heart;
  if (label.includes("building")) return Building2;

  return MapPin;
}

/**
 * Get an icon for an inferred place type.
 */
export function getPlaceIconForType(type: string | null): LucideIcon {
  switch (type) {
    case "home":
      return Home;
    case "work":
      return Briefcase;
    case "frequent":
      return MapPin;
    default:
      return MapPin;
  }
}

/**
 * Get color for an inferred place type.
 */
export function getPlaceTypeColor(type: string | null): string {
  switch (type) {
    case "home":
      return "#22C55E"; // Green
    case "work":
      return "#3B82F6"; // Blue
    case "frequent":
      return "#F59E0B"; // Amber
    default:
      return "#6B7280"; // Gray
  }
}

/**
 * Get color for confidence score.
 */
export function getConfidenceColor(score: number): string {
  if (score >= 0.7) return "#22C55E"; // Green
  if (score >= 0.4) return "#F59E0B"; // Orange
  return "#EF4444"; // Red
}

/**
 * Get banner colors for a location block.
 *
 * Priority:
 * 1. Travel blocks → orange
 * 2. Inferred type (home/work/frequent) → mapped color
 * 3. Label keyword matching (gym/fitness) → green
 * 4. Default → slate
 */
export function getLocationBannerColor(block: LocationBlock): LocationBannerColors {
  if (block.type === "travel") return LOCATION_COLORS.travel;

  const inferredType = block.inferredPlace?.inferredType;
  if (inferredType && LOCATION_COLORS[inferredType]) {
    return LOCATION_COLORS[inferredType];
  }

  const label = block.locationLabel.toLowerCase();
  if (label.includes("gym") || label.includes("fitness")) {
    return LOCATION_COLORS.gym;
  }

  return LOCATION_COLORS.unknown;
}
