# React Native DateTimePicker

- Docs: https://github.com/react-native-datetimepicker/datetimepicker
- Notes: Use `mode="time"` with `display="spinner"` on iOS to render the native wheel picker. On Android, `display="spinner"` keeps the compact inline control; `display="default"` opens the platform modal clock. Controlled usage: listen to `onChange` for `{ type, nativeEvent, value }` where `type === 'set'` signals confirmation, and keep a fallback to the previous value when `value` is undefined.
