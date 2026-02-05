import { ExpoRoot } from "expo-router";
import { ctx } from "expo-router/_ctx";

// Fallback entry for builds/dev-clients that boot via `expo/AppEntry`.
// Expo Router projects typically use `"main": "expo-router/entry"`, but some native/dev
// setups can still attempt to load `App.*` from the project root.
export default function App() {
  return <ExpoRoot context={ctx} />;
}

