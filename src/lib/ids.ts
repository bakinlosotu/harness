export function generateId(prefix = 'id'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 9);
  return `${prefix}_${ts}_${rand}`;
}
