export function uuid() {
  // RFC4122 v4-ish, good enough for local ids
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 0xf) >> 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function hashFile(file: Blob) {
  const buf = await file.slice(0, Math.min(file.size, 8 * 1024 * 1024)).arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  const arr = Array.from(new Uint8Array(hash));
  return arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function debounce<T extends (...args: any[]) => void>(fn: T, ms = 250) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
  t = window.setTimeout(() => fn(...args), ms) as unknown as number;
  };
}
