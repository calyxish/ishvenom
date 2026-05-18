/**
 * Expo app config — replaces app.json so we can read env variables at
 * build time.  All EXPO_PUBLIC_* variables are automatically embedded into
 * the JS bundle and available via process.env at runtime on the device.
 *
 * How to set the Google AI key for local development:
 *   1. Copy .env.example to .env
 *   2. Paste your key from https://aistudio.google.com/app/apikey
 *   3. Restart Metro (npx expo start --clear)
 *
 * The key is only used when present.  If absent, the app falls back to the
 * on-device llama.rn runtime (requires the .gguf model file in assets/).
 */

/** @type {import('@expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'IshVenom',
    slug: 'ishvenom',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'ishvenom',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0b1020',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.calyxish.ishvenom',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0b1020',
      },
      package: 'com.calyxish.ishvenom',
      permissions: [
        'android.permission.CAMERA',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.INTERNET',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.SEND_SMS',
      ],
    },
    plugins: [
      'expo-router',
      'expo-camera',
      'expo-location',
      [
        'expo-image-picker',
        {
          photosPermission:
            'IshVenom needs access to your photos to identify snakes from saved images.',
        },
      ],
    ],
    experiments: { typedRoutes: true },
    // EXPO_PUBLIC_* vars are inlined at build time — no server secret exposure
    extra: {
      googleAiKey: process.env.EXPO_PUBLIC_GOOGLE_AI_KEY ?? null,
    },
  },
};
