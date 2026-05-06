import { PALETTE } from '../constants/colors';

export type CircuitTheme = {
  line: string;
  text: string;
};

export const CIRCUIT_THEME_BY_NAME: Record<string, CircuitTheme> = {
  SHANGHAI: { line: PALETTE.red, text: PALETTE.red },
  'LAS VEGAS': { line: PALETTE.blue, text: PALETTE.blue },
  SUZUKA: { line: PALETTE.red, text: PALETTE.red },
  MONACO: { line: PALETTE.red, text: PALETTE.red },
  HUNGARY: { line: PALETTE.green, text: PALETTE.green },
  HUNGARORING: { line: PALETTE.green, text: PALETTE.green },
  'MARINA BAY': { line: PALETTE.red, text: PALETTE.red },
  MONZA: { line: PALETTE.green, text: PALETTE.green },
  BAKU: { line: '#04A6CB', text: '#04A6CB' },
  'ALBERT PARK': { line: PALETTE.blue, text: PALETTE.blue },
  SILVERSTONE: { line: PALETTE.blue, text: PALETTE.blue },
  SPA: { line: PALETTE.yellow, text: PALETTE.yellow },
};

export const DEFAULT_CIRCUIT_THEME: CircuitTheme = { line: PALETTE.red, text: PALETTE.red };

export function getCircuitTheme(circuitDisplayName: string): CircuitTheme {
  return CIRCUIT_THEME_BY_NAME[circuitDisplayName.toUpperCase()] ?? DEFAULT_CIRCUIT_THEME;
}
