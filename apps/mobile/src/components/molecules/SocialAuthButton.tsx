import { Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

interface SocialAuthButtonProps {
  label: string;
  variant: "apple" | "google";
  onPress: () => void;
  disabled?: boolean;
}

const AppleLogo = ({ color = "#FFFFFF" }: { color?: string }) => (
  <Svg width={18} height={22} viewBox="0 0 18 22" fill="none">
    <Path
      d="M14.73 11.66c-.02-2.13 1.74-3.15 1.82-3.2-1-1.46-2.57-1.66-3.12-1.68-1.32-.13-2.56.78-3.22.78-.66 0-1.7-.76-2.8-.74-1.43.02-2.75.84-3.48 2.13-1.49 2.58-.38 6.38 1.06 8.47.72 1.04 1.56 2.2 2.66 2.16 1.07-.04 1.47-.7 2.76-.7 1.29 0 1.64.7 2.77.68 1.15-.02 1.88-1.05 2.58-2.1.83-1.22 1.17-2.41 1.19-2.47-.02-.01-2.29-.88-2.32-3.33Z"
      fill={color}
    />
    <Path
      d="M12.88 4.63c.59-.71.99-1.69.88-2.67-.86.04-1.86.57-2.47 1.28-.54.63-1 1.63-.88 2.59.94.07 1.88-.5 2.47-1.2Z"
      fill={color}
    />
  </Svg>
);

const GoogleLogo = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
    <Path
      d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.83h5.42a4.57 4.57 0 0 1-2 3.01v2.51h3.23C18.92 15.78 19.6 13.2 19.6 10.23Z"
      fill="#4285F4"
    />
    <Path
      d="M10 20c2.7 0 4.96-.9 6.62-2.45l-3.23-2.51c-.9.6-2.05.95-3.39.95-2.62 0-4.83-1.77-5.62-4.15H1.1v2.6A10 10 0 0 0 10 20Z"
      fill="#34A853"
    />
    <Path
      d="M4.38 11.84a6.02 6.02 0 0 1 0-3.75V5.5H1.1a10 10 0 0 0 0 8.99l3.28-2.65Z"
      fill="#FBBC05"
    />
    <Path
      d="M10 3.96c1.47 0 2.8.52 3.85 1.56l2.88-2.87A9.95 9.95 0 0 0 10 0 10 10 0 0 0 1.1 5.5l3.28 2.59C5.17 5.73 7.38 3.96 10 3.96Z"
      fill="#EA4335"
    />
  </Svg>
);

export const SocialAuthButton = ({
  label,
  variant,
  onPress,
  disabled = false,
}: SocialAuthButtonProps) => {
  const isApple = variant === "apple";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className="w-full"
      style={({ pressed }) => [{ opacity: pressed && !disabled ? 0.95 : 1 }]}
    >
      <View
        className={
          isApple
            ? "flex-row items-center justify-center px-4 py-4 rounded-2xl bg-black shadow-sm shadow-slate-300"
            : "flex-row items-center justify-center px-4 py-4 rounded-2xl border border-slate-200 bg-white"
        }
      >
        {isApple ? <AppleLogo /> : <GoogleLogo />}
        <Text
          className={
            isApple
              ? "ml-3 text-base font-semibold text-white"
              : "ml-3 text-base font-semibold text-text-primary"
          }
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
};
