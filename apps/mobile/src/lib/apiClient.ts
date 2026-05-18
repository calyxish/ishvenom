/**
 * apiClient — app-wide singleton for the IshVenom backend.
 *
 * Reads EXPO_PUBLIC_API_URL at Metro build time.
 * Falls back to the Android emulator loopback so local dev works out of the box.
 */
import { createApiClient } from './api';

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

export const apiClient = createApiClient({ baseUrl: API_URL });
