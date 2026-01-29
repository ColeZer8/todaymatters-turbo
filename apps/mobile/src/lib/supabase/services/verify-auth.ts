import { supabase } from "../client";
import { fetchProfileValues } from "./profile-values";
import { handleSupabaseError } from "../utils/error-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Verification helper to check auth status and saved data
 * Call this from the console or a debug screen to verify everything is working
 */
export async function verifyAuthAndData() {
  console.log("🔍 Verifying Auth and Data...\n");

  // Check session
  let session;
  let sessionError;
  try {
    const result = await supabase.auth.getSession();
    session = result.data?.session ?? null;
    sessionError = result.error ?? null;
  } catch (error) {
    if (__DEV__) {
      console.error("❌ Network error in getSession():", {
        error,
        message: error instanceof Error ? error.message : String(error),
        supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      });
    }
    sessionError = error;
    session = null;
  }

  if (sessionError) {
    console.error("❌ Session Error:", sessionError);
    return { success: false, error: sessionError };
  }

  if (!session?.user) {
    console.log("⚠️ No active session - user is not authenticated");
    if (__DEV__) {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const supabaseKeys = keys.filter(
          (key) =>
            key.includes("sb-") ||
            key.includes("supabase") ||
            key.includes("auth"),
        );
        console.log("🔍 AsyncStorage keys (filtered):", supabaseKeys);
      } catch (error) {
        console.log("⚠️ Unable to read AsyncStorage keys:", error);
      }
    }
    return { success: false, authenticated: false };
  }

  const user = session.user;
  console.log("✅ Authentication Status:");
  console.log("   User ID:", user.id);
  console.log("   Email:", user.email);
  console.log("   Created:", user.created_at);
  console.log("   Email Confirmed:", user.email_confirmed_at ? "Yes" : "No\n");

  // Extra verification: validate token against Supabase (network)
  // Only call getUser() if we have a valid session with an access token
  if (!session.access_token) {
    console.log("⚠️ No access token in session, skipping getUser()");
  } else {
    let userData;
    let userError;
    try {
      const result = await supabase.auth.getUser();
      userData = result.data;
      userError = result.error;
    } catch (error) {
      if (__DEV__) {
        console.error("❌ Network error in getUser():", {
          error,
          message: error instanceof Error ? error.message : String(error),
          supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
        });
      }
      userError = error;
    }
    
    if (userError) {
      console.log("⚠️ getUser() error:", userError);
    } else {
      console.log("✅ getUser() ok:", { userId: userData?.user?.id ?? null });
    }
  }

  // Check profile record
  console.log("📋 Checking Profile Record...");
  try {
    let profile;
    let profileError;
    try {
      const result = await supabase
        .schema("tm")
        .from("profiles")
        .select("user_id, created_at")
        .eq("user_id", user.id)
        .single();
      profile = result.data;
      profileError = result.error;
    } catch (error) {
      if (__DEV__) {
        console.error("❌ Network error querying profiles:", {
          error,
          message: error instanceof Error ? error.message : String(error),
          supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
        });
      }
      profileError = error;
      profile = null;
    }

    if (profileError) {
      const error = handleSupabaseError(profileError);
      console.log(
        "⚠️ Profile record:",
        profileError.code === "PGRST116" ? "Not found" : error.message,
      );
    } else {
      console.log("✅ Profile record exists");
      console.log("   User ID:", profile.user_id);
      console.log("   Created:", profile.created_at);
    }
  } catch (error) {
    console.error("❌ Error checking profile:", error);
  }

  // Check profile values
  console.log("\n📊 Checking Profile Values...");
  try {
    let valuesData;
    let valuesError;
    try {
      const result = await supabase
        .schema("tm")
        .from("profile_values")
        .select("id, value_label, rank, created_at")
        .eq("user_id", user.id)
        .order("rank", { ascending: true });
      valuesData = result.data;
      valuesError = result.error;
    } catch (error) {
      if (__DEV__) {
        console.error("❌ Network error querying profile_values:", {
          error,
          message: error instanceof Error ? error.message : String(error),
          supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
        });
      }
      valuesError = error;
      valuesData = null;
    }

    if (valuesError) {
      // If table isn't created yet (or schema cache not refreshed), don't spam errors in dev.
      if (valuesError.code === "PGRST205") {
        console.log(
          "⚠️ tm.profile_values not available yet (missing table or schema cache not refreshed).",
        );
      } else {
        const error = handleSupabaseError(valuesError);
        console.error("❌ Error fetching profile values:", error.message);
      }
    } else {
      const values = valuesData || [];
      console.log("✅ Profile Values Found in Supabase:", values.length);
      if (values.length > 0) {
        values.forEach((value, index) => {
          console.log(
            `   ${index + 1}. "${value.value_label}" (rank: ${value.rank}, id: ${value.id})`,
          );
        });
      } else {
        console.log("   (No values saved yet)");
      }
    }
  } catch (error) {
    console.error("❌ Error fetching profile values:", error);
  }

  console.log("\n✅ Verification Complete");
  return {
    success: true,
    authenticated: true,
    userId: user.id,
    email: user.email,
  };
}

// Make it available globally for easy console access
if (typeof window !== "undefined") {
  window.verifyAuth = verifyAuthAndData;
}

declare global {
  interface Window {
    verifyAuth?: typeof verifyAuthAndData;
  }
}

export {};
