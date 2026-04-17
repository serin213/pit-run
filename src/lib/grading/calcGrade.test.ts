import { describe, it, expect } from 'vitest';
import {
  calcGradeFromPace,
  assignGrade,
  isGradeExpired,
  requiresReQualifying,
  getDaysUntilExpiry,
  REQUALIFYING_INTERVAL_MS,
} from './calcGrade';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── calcGradeFromPace ────────────────────────────────────────────────────────

describe('calcGradeFromPace', () => {
  it('200초 → f1_champion', () => {
    expect(calcGradeFromPace(200)).toBe('f1_champion');
  });

  it('220초 → f1 (경계값, minPaceSec 포함)', () => {
    expect(calcGradeFromPace(220)).toBe('f1');
  });

  it('219초 → f1_champion (경계값 직전)', () => {
    expect(calcGradeFromPace(219)).toBe('f1_champion');
  });

  it('360초 → f3', () => {
    expect(calcGradeFromPace(360)).toBe('f3');
  });

  it('285초 → f2 (경계값)', () => {
    expect(calcGradeFromPace(285)).toBe('f2');
  });

  it('0 입력 → throw', () => {
    expect(() => calcGradeFromPace(0)).toThrow('Invalid qualifying time');
  });

  it('-10 입력 → throw', () => {
    expect(() => calcGradeFromPace(-10)).toThrow('Invalid qualifying time');
  });
});

// ─── assignGrade ─────────────────────────────────────────────────────────────

describe('assignGrade', () => {
  const now = 1_700_000_000_000;

  it('F1 Champion (200초) → expiresAt = now + 90일', () => {
    const result = assignGrade(200, now);
    expect(result.grade).toBe('f1_champion');
    expect(result.expiresAt).toBe(now + REQUALIFYING_INTERVAL_MS);
  });

  it('F2 (300초) → expiresAt null', () => {
    const result = assignGrade(300, now);
    expect(result.grade).toBe('f2');
    expect(result.expiresAt).toBeNull();
  });

  it('F3 (400초) → expiresAt null', () => {
    const result = assignGrade(400, now);
    expect(result.grade).toBe('f3');
    expect(result.expiresAt).toBeNull();
  });

  it('F1 Rookie (260초) → expiresAt = now + 90일', () => {
    const result = assignGrade(260, now);
    expect(result.grade).toBe('f1_rookie');
    expect(result.expiresAt).toBe(now + REQUALIFYING_INTERVAL_MS);
  });

  it('assignedAt이 입력 now와 동일', () => {
    const result = assignGrade(200, now);
    expect(result.assignedAt).toBe(now);
  });

  it('qualifyingTime1km이 입력값 그대로 저장', () => {
    const result = assignGrade(235, now);
    expect(result.qualifyingTime1km).toBe(235);
  });
});

// ─── isGradeExpired ───────────────────────────────────────────────────────────

describe('isGradeExpired', () => {
  const now = 1_700_000_000_000;

  it('expiresAt이 null이면 항상 false', () => {
    const assignment = assignGrade(300, now); // F2, expiresAt null
    expect(isGradeExpired(assignment, now + 1000 * DAY_MS)).toBe(false);
  });

  it('expiresAt이 미래면 false', () => {
    const assignment = assignGrade(200, now); // F1 Champion
    expect(isGradeExpired(assignment, now + 30 * DAY_MS)).toBe(false);
  });

  it('expiresAt이 과거면 true', () => {
    const assignment = assignGrade(200, now); // F1 Champion, expiresAt = now + 90일
    expect(isGradeExpired(assignment, now + 91 * DAY_MS)).toBe(true);
  });
});

// ─── requiresReQualifying ─────────────────────────────────────────────────────

describe('requiresReQualifying', () => {
  const now = 1_700_000_000_000;

  it('F2 유저는 만료돼도 false (expiresAt이 null)', () => {
    const assignment = assignGrade(300, now);
    expect(requiresReQualifying(assignment, now + 1000 * DAY_MS)).toBe(false);
  });

  it('F1 유저가 만료 전이면 false', () => {
    const assignment = assignGrade(230, now);
    expect(requiresReQualifying(assignment, now + 30 * DAY_MS)).toBe(false);
  });

  it('F1 유저가 만료 후면 true', () => {
    const assignment = assignGrade(230, now);
    expect(requiresReQualifying(assignment, now + 91 * DAY_MS)).toBe(true);
  });

  it('F1 Champion이 만료 후면 true', () => {
    const assignment = assignGrade(200, now);
    expect(requiresReQualifying(assignment, now + 91 * DAY_MS)).toBe(true);
  });
});

// ─── getDaysUntilExpiry ───────────────────────────────────────────────────────

describe('getDaysUntilExpiry', () => {
  const now = 1_700_000_000_000;

  it('만료 30일 남은 F1 → 30', () => {
    const assignment = assignGrade(230, now); // expiresAt = now + 90일
    const days = getDaysUntilExpiry(assignment, now + 60 * DAY_MS);
    expect(days).toBeCloseTo(30, 5);
  });

  it('만료 5일 지난 F1 → -5', () => {
    const assignment = assignGrade(230, now);
    const days = getDaysUntilExpiry(assignment, now + 95 * DAY_MS);
    expect(days).toBeCloseTo(-5, 5);
  });

  it('F2 → null', () => {
    const assignment = assignGrade(300, now);
    expect(getDaysUntilExpiry(assignment, now)).toBeNull();
  });
});
