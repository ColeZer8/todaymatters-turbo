import { Text, TextProps } from "react-native";

interface TypographyProps extends TextProps {
  variant?: "h1" | "h2" | "h3" | "h4" | "body" | "caption" | "link";
}

export const Typography = ({
  variant = "body",
  className,
  style,
  ...props
}: TypographyProps) => {
  let baseStyle = "font-sans";

  switch (variant) {
    case "h1":
      baseStyle += " text-6xl font-black text-text-primary tracking-tight";
      break;
    case "h4":
      baseStyle += " text-4xl font-black text-text-primary tracking-tight";
      break;
    case "h2":
      baseStyle +=
        " text-xs font-bold text-text-secondary uppercase tracking-[0.2em]";
      break;
    case "h3":
      baseStyle += " text-[15px] font-bold text-text-primary";
      break;
    case "body":
      baseStyle += " text-lg text-text-secondary leading-7";
      break;
    case "caption":
      baseStyle += " text-sm text-text-tertiary";
      break;
    case "link":
      baseStyle += " text-sm font-semibold text-brand-primary";
      break;
  }

  return (
    <Text
      className={`${baseStyle} ${className || ""}`}
      style={style}
      {...props}
    />
  );
};
