// Runs before every test file.

// Screens read the phone's safe-area insets (notch, home bar). The library ships this mock,
// which gives zero insets without needing a <SafeAreaProvider>.
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
