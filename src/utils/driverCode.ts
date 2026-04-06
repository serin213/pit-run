export function getDriverCode(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'ABC';
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const source = tokens[tokens.length - 1] ?? '';
  const code = source.slice(0, 3).toUpperCase();
  return code || 'ABC';
}

export function getDriverDisplayName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'LECLERC';
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return trimmed.toUpperCase();
  return (tokens[tokens.length - 1] ?? trimmed).toUpperCase();
}
