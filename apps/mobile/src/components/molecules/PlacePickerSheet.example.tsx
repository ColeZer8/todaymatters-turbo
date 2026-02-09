/**
 * PlacePickerSheet Usage Example
 *
 * Shows how to integrate the PlacePickerSheet component with
 * the location-place-lookup edge function response.
 */

import { useState } from "react";
import { Button } from "react-native";
import { PlacePickerSheet, type PlaceSelection } from "./PlacePickerSheet";
import { createUserPlace } from "@/lib/supabase/services/user-places";
import { useAuth } from "@/hooks/use-auth";

export function PlacePickerExample() {
  const { user } = useAuth();
  const [showPicker, setShowPicker] = useState(false);

  // Example data from location-place-lookup edge function
  const mockEdgeFunctionResponse = {
    placeName: "God's House Kindergarten",
    alternatives: [
      {
        placeName: "Vestavia Hills Baptist",
        googlePlaceId: "ChIJK1234567890",
        vicinity: "2600 Vestavia Dr",
        types: ["church", "place_of_worship"],
        distanceMeters: 85,
      },
      {
        placeName: "Sonic Drive-In",
        googlePlaceId: "ChIJK9876543210",
        vicinity: "4680 Caldwell Mill Rd",
        types: ["restaurant", "food"],
        distanceMeters: 150,
      },
      {
        placeName: "Shell Gas Station",
        googlePlaceId: "ChIJK1111111111",
        vicinity: "4700 Caldwell Mill Rd",
        types: ["gas_station"],
        distanceMeters: 200,
      },
    ],
  };

  const sessionData = {
    latitude: 33.4484,
    longitude: -86.7908,
    startTime: new Date(2024, 1, 9, 9, 14),
    endTime: new Date(2024, 1, 9, 9, 20),
  };

  const handleSave = async (selection: PlaceSelection) => {
    if (!user?.id) return;

    try {
      // Save to user_places via existing service
      await createUserPlace({
        userId: user.id,
        label: selection.placeName,
        latitude: sessionData.latitude,
        longitude: sessionData.longitude,
        category: selection.category,
        radiusMeters: 150, // Default 150m radius
      });

      console.log("✅ Place saved:", selection);
      setShowPicker(false);

      // Optionally: Trigger re-ingestion or update the session in place
      // await reIngestSession(sessionId);
    } catch (error) {
      console.error("❌ Failed to save place:", error);
    }
  };

  return (
    <>
      <Button title="Open Place Picker" onPress={() => setShowPicker(true)} />

      <PlacePickerSheet
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onSave={handleSave}
        currentPlace={mockEdgeFunctionResponse.placeName}
        alternatives={mockEdgeFunctionResponse.alternatives}
        latitude={sessionData.latitude}
        longitude={sessionData.longitude}
        startTime={sessionData.startTime}
        endTime={sessionData.endTime}
      />
    </>
  );
}
