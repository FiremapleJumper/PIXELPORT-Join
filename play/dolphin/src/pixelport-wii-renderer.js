export const WII_RENDERER_PREFERENCE = 'pixelport-wii-renderer';

// The Wii bundle contains OpenGL. Its Naga stub only excludes hardware WebGPU.
export function normalizeWiiRenderer(value) {
  return ['software', 'ogl', 'null'].includes(value) ? value : 'ogl';
}

export function readWiiRendererPreference(storage) {
  try {
    const value = (storage ?? globalThis.localStorage).getItem(WII_RENDERER_PREFERENCE);
    return value === null ? 'software' : normalizeWiiRenderer(value);
  } catch {
    return 'software';
  }
}

export function rememberWiiRenderer(value, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(WII_RENDERER_PREFERENCE, normalizeWiiRenderer(value));
  } catch {}
}
