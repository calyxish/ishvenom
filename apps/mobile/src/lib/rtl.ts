/**
 * RTL handling for Arabic.
 *
 * React Native has a global I18nManager that must be flipped before
 * the first render to get correct Arabic layout. Flipping it at runtime
 * requires a reload — so we detect at app start whether the desired
 * direction matches the current one, and if not, schedule a reload.
 *
 * The actual I18nManager and DevSettings imports are lazy so this
 * module is pure-TS testable.
 */
import type { Language } from '@ishvenom/shared-types';

export function isRtlLanguage(lang: Language): boolean {
  return lang === 'ar';
}

export interface RtlBridge {
  isRTL: boolean;
  allowRTL(flag: boolean): void;
  forceRTL(flag: boolean): void;
  reload(): void;
}

function createRealBridge(): RtlBridge {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { I18nManager, DevSettings } = require('react-native') as {
    I18nManager: {
      isRTL: boolean;
      allowRTL: (f: boolean) => void;
      forceRTL: (f: boolean) => void;
    };
    DevSettings: { reload: () => void };
  };
  return {
    get isRTL() {
      return I18nManager.isRTL;
    },
    allowRTL: (f) => I18nManager.allowRTL(f),
    forceRTL: (f) => I18nManager.forceRTL(f),
    reload: () => DevSettings.reload(),
  };
}

let bridge: RtlBridge | null = null;

export function setRtlBridge(b: RtlBridge): void {
  bridge = b;
}

function getBridge(): RtlBridge {
  if (!bridge) bridge = createRealBridge();
  return bridge;
}

export interface RtlSyncResult {
  changed: boolean;
  willReload: boolean;
  desiredRtl: boolean;
  currentRtl: boolean;
}

export function syncRtlForLanguage(lang: Language): RtlSyncResult {
  const desiredRtl = isRtlLanguage(lang);
  const b = getBridge();
  const currentRtl = b.isRTL;
  if (desiredRtl === currentRtl) {
    return { changed: false, willReload: false, desiredRtl, currentRtl };
  }
  b.allowRTL(desiredRtl);
  b.forceRTL(desiredRtl);
  b.reload();
  return { changed: true, willReload: true, desiredRtl, currentRtl };
}
