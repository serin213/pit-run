import type { TireType } from './colors';

export interface TireConfig {
  type: TireType;
  label: string;
  emoji: string;
  boxBoxDistKm: number; // BOX BOX 발동 거리 기준 (km)
}

export const TIRES: Record<TireType, TireConfig> = {
  soft:   { type: 'soft',   label: 'SOFT',   emoji: '🔴', boxBoxDistKm: 0.5 },
  medium: { type: 'medium', label: 'MEDIUM', emoji: '🟡', boxBoxDistKm: 1.0 },
  hard:   { type: 'hard',   label: 'HARD',   emoji: '⚪', boxBoxDistKm: 1.5 },
  wet:    { type: 'wet',    label: 'WET',    emoji: '🌧️', boxBoxDistKm: 0.3 },
};

export const CIRCUIT_KM = 5.14;   // 상하이 서킷
export const BASE_PACE_S = 301;   // 기본 목표 페이스 (5'01"/km)
export const PACE_RECORD_INTERVAL_KM = 0.5; // 500m마다 페이스 기록
