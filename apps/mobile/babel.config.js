module.exports = function (api) {
  api.cache(true);
  const isTest = process.env.BABEL_ENV === "test" || process.env.NODE_ENV === "test";
  return {
    presets: [
      ["babel-preset-expo", isTest ? {} : { jsxImportSource: "nativewind" }],
      ...(isTest ? [] : ["nativewind/babel"]),
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: {
            "@": "./src",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
