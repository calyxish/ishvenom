import { isRtlLanguage, syncRtlForLanguage, setRtlBridge } from '../lib/rtl';

function makeBridge(initialRtl: boolean) {
  const state = { isRTL: initialRtl, reloaded: false, allow: initialRtl, force: initialRtl };
  const bridge = {
    get isRTL() {
      return state.isRTL;
    },
    allowRTL: (f: boolean) => {
      state.allow = f;
    },
    forceRTL: (f: boolean) => {
      state.force = f;
      state.isRTL = f;
    },
    reload: () => {
      state.reloaded = true;
    },
  };
  return { bridge, state };
}

test('isRtlLanguage returns true only for Arabic', () => {
  expect(isRtlLanguage('ar')).toBe(true);
  (['en', 'fr', 'ha', 'sw', 'tw'] as const).forEach((l) =>
    expect(isRtlLanguage(l)).toBe(false),
  );
});

test('no-op when direction already matches language', () => {
  const { bridge, state } = makeBridge(false);
  setRtlBridge(bridge);
  const r = syncRtlForLanguage('en');
  expect(r.changed).toBe(false);
  expect(r.willReload).toBe(false);
  expect(state.reloaded).toBe(false);
});

test('flips to RTL and reloads when switching to Arabic', () => {
  const { bridge, state } = makeBridge(false);
  setRtlBridge(bridge);
  const r = syncRtlForLanguage('ar');
  expect(r.changed).toBe(true);
  expect(r.willReload).toBe(true);
  expect(state.force).toBe(true);
  expect(state.reloaded).toBe(true);
});

test('flips back to LTR and reloads when switching away from Arabic', () => {
  const { bridge, state } = makeBridge(true);
  setRtlBridge(bridge);
  const r = syncRtlForLanguage('fr');
  expect(r.changed).toBe(true);
  expect(state.force).toBe(false);
  expect(state.reloaded).toBe(true);
});
