export type CircuitTheme = {
  line: string;
  text: string;
};

export const CIRCUIT_THEME_BY_NAME: Record<string, CircuitTheme> = {
  SHANGHAI: { line: '#E03A3E', text: '#E03A3E' },
  'LAS VEGAS': { line: '#3F5CFF', text: '#657DFF' },
  SUZUKA: { line: '#FFFFFF', text: '#FFFFFF' },
  MONACO: { line: '#E03A3E', text: '#E03A3E' },
  HUNGARY: { line: '#59B345', text: '#59B345' },
  HUNGARORING: { line: '#59B345', text: '#59B345' },
  'MARINA BAY': { line: '#E03A3E', text: '#E03A3E' },
  MONZA: { line: '#59B345', text: '#59B345' },
  BAKU: { line: '#04A6CB', text: '#04A6CB' },
  'ALBERT PARK': { line: '#3F5CFF', text: '#657DFF' },
  SILVERSTONE: { line: '#3F5CFF', text: '#657DFF' },
  SPA: { line: '#FCB827', text: '#FCB827' },
};

export const DEFAULT_CIRCUIT_THEME: CircuitTheme = { line: '#E03A3E', text: '#E03A3E' };

export function getCircuitTheme(circuitDisplayName: string): CircuitTheme {
  return CIRCUIT_THEME_BY_NAME[circuitDisplayName.toUpperCase()] ?? DEFAULT_CIRCUIT_THEME;
}
