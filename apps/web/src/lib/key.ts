export const toKey = (label: string): string | null => {
  const slug = label
    .trim()
    .toLowerCase()
    .replaceAll('ł', 'l')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!/[a-z]/.test(slug)) return null;
  return /^[0-9]/.test(slug) ? `key_${slug}` : slug;
};
