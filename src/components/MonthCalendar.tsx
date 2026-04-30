/**
 * MonthCalendar — WeekStrip + MonthGrid 공유 컴포넌트
 * HomeScreen과 HistoryScreen에서 동일하게 사용
 */

import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLG,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import GradientCardBorder from './GradientCardBorder';
import { radius } from '../constants/radius';

// ─── Assets ──────────────────────────────────────────────────────────────────

const QUAL_ICON = require('../../assets/calander-qualifying.png');

// ─── Constants ───────────────────────────────────────────────────────────────

const WEEK_LABELS = ['M', 'T', 'W', 'T', 'P', 'Q', 'R'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ARROW_LEFT_PATH =
  'M4.58582 9L1.29292 5.70711C0.902397 5.31658 0.902398 4.68342 1.29292 4.29289L4.58582 1';
const ARROW_RIGHT_PATH =
  'M1 1L4.29289 4.29289C4.68342 4.68342 4.68342 5.31658 4.29289 5.70711L1 9';

// ─── Helpers (exported for use in parent screens) ─────────────────────────────

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function getWeekDates(ref: Date): Date[] {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    return dd;
  });
}

export const MONTH_GRID_HEIGHT_5 = 292;
export const MONTH_GRID_HEIGHT_6 = 332;

export function getMonthRowCount(year: number, month: number): number {
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Math.ceil((firstDow + daysInMonth) / 7);
}

export function getMonthGridHeight(rowCount: number): number {
  return rowCount <= 5 ? MONTH_GRID_HEIGHT_5 : MONTH_GRID_HEIGHT_6;
}

/** colX 동적 계산: M=left 20, R=right 20, 나머지 space-between */
export function calcColX(cardW: number): number[] {
  const step = (cardW - 64) / 6;
  return Array.from({ length: 7 }, (_, i) => Math.round(20 + i * step));
}

export function findRunGroups(
  cells: (number | null)[],
  getISO: (d: number) => string,
  activitySet: Set<string>,
): { start: number; end: number }[] {
  const groups: { start: number; end: number }[] = [];
  let i = 0;
  while (i < cells.length) {
    const d = cells[i];
    if (d && activitySet.has(getISO(d))) {
      let j = i;
      while (j < cells.length && cells[j] && activitySet.has(getISO(cells[j]!))) j++;
      groups.push({ start: i, end: j - 1 });
      i = j;
    } else {
      i++;
    }
  }
  return groups;
}

export function pillGeometry(colX: number[], startCol: number, endCol: number) {
  const extend = endCol > startCol ? 2 : 0;
  return {
    left: colX[startCol] - 2 - extend,
    width: colX[endCol] - colX[startCol] + 28 + extend * 2,
  };
}

// ─── GradPill ─────────────────────────────────────────────────────────────────

let _pillId = 0;

function GradPill({ left, top, width, height }: {
  left: number; top: number; width: number; height: number;
}) {
  const id = useMemo(() => `p${_pillId++}`, []);
  return (
    <Svg style={{ position: 'absolute', left, top }} width={width} height={height}>
      <Defs>
        <SvgLG id={id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0%" stopColor="#E03A3E" />
          <Stop offset="100%" stopColor="#E03A8A" />
        </SvgLG>
      </Defs>
      <Rect
        x={0.25} y={0.25}
        width={width - 0.5} height={height - 0.5}
        rx={14}
        fill={`url(#${id})`}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
      />
    </Svg>
  );
}

// ─── WeekStrip ────────────────────────────────────────────────────────────────

export type WeekStripProps = {
  today: string;
  activitySet: Set<string>;
  qualifyingSet?: Set<string>;
  colX: number[];
  bare?: boolean;
};

export function WeekStrip({ today, activitySet, qualifyingSet, colX, bare }: WeekStripProps) {
  const weekDates = getWeekDates(new Date(today));
  const isoList = weekDates.map(toISO);

  const activityOrQualSet = useMemo(() => {
    if (!qualifyingSet?.size) return activitySet;
    return new Set([...activitySet, ...qualifyingSet]);
  }, [activitySet, qualifyingSet]);

  const runGroups = findRunGroups(
    weekDates.map((_, i) => i) as number[],
    (i) => isoList[i],
    activityOrQualSet,
  );

  const runCols = new Set(runGroups.flatMap((g) =>
    Array.from({ length: g.end - g.start + 1 }, (_, k) => g.start + k),
  ));

  const inner = (
    <>
      {WEEK_LABELS.map((label, col) => (
        <Text key={`wl-${col}`} style={[s.calLabel, { left: colX[col] }]}>
          {label}
        </Text>
      ))}

      {weekDates.map((_, col) => {
        if (runCols.has(col)) return null;
        return <View key={`wc-${col}`} style={[s.dayCircle, { left: colX[col] - 2, top: 36 }]} />;
      })}

      {runGroups.map((g, k) => {
        const { left, width } = pillGeometry(colX, g.start, g.end);
        return <GradPill key={`wp-${k}`} left={left} top={36} width={width} height={28} />;
      })}

      {weekDates.map((d, col) => {
        const iso = isoList[col];
        const isPast = iso <= today;
        const isQual = qualifyingSet?.has(iso) ?? false;
        if (isQual) {
          return (
            <Image
              key={`wn-${col}`}
              source={QUAL_ICON}
              style={[s.qualIcon, { left: colX[col] + 4, top: 42 }]}
              resizeMode="contain"
            />
          );
        }
        return (
          <Text
            key={`wn-${col}`}
            style={[
              s.calNum,
              { left: colX[col] - 2, top: 42 },
              isPast ? s.calNumPast : s.calNumFuture,
              runCols.has(col) ? s.calNumRun : null,
            ]}
          >
            {d.getDate()}
          </Text>
        );
      })}
    </>
  );

  if (bare) return <View style={{ flex: 1, overflow: 'hidden' }}>{inner}</View>;

  return (
    <GradientCardBorder style={s.calCard} innerStyle={{ overflow: 'hidden' }} borderRadius={radius.md.borderRadius}>
      {inner}
    </GradientCardBorder>
  );
}

// ─── MonthGrid ────────────────────────────────────────────────────────────────

export type MonthGridProps = {
  today: string;
  activitySet: Set<string>;
  qualifyingSet?: Set<string>;
  colX: number[];
  monthOffset: number;
  onPrev: () => void;
  onNext: () => void;
  bare?: boolean;
};

export function MonthGrid({ today, activitySet, qualifyingSet, colX, monthOffset, onPrev, onNext, bare }: MonthGridProps) {
  const base = new Date(today);
  const year = base.getFullYear();
  const month = base.getMonth() + monthOffset;
  const refYear = year + Math.floor(month / 12);
  const refMonth = ((month % 12) + 12) % 12;
  const daysInMonth = new Date(refYear, refMonth + 1, 0).getDate();
  const firstDow = (new Date(refYear, refMonth, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const rowCount = Math.ceil(cells.length / 7);
  while (cells.length < rowCount * 7) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  const ROW_Y = [84, 124, 164, 204, 244, 284];

  function dayISO(d: number) {
    return `${refYear}-${String(refMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  const inner = (
    <>
      {/* ‹ Month › — flex row so › always follows the month text */}
      <View style={s.monthHeader}>
        <Pressable onPress={onPrev} hitSlop={14} style={s.monthArrow}>
          <Svg width={6} height={10} viewBox="0 0 6 10">
            <Path
              d={ARROW_LEFT_PATH}
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />
          </Svg>
        </Pressable>
        <Text style={s.monthTitle}>{MONTH_NAMES[refMonth]}</Text>
        <Pressable onPress={onNext} hitSlop={14} style={[s.monthArrow, { marginLeft: 8 }]}>
          <Svg width={6} height={10} viewBox="0 0 6 10">
            <Path
              d={ARROW_RIGHT_PATH}
              stroke="white"
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
              opacity={0.5}
            />
          </Svg>
        </Pressable>
      </View>

      {WEEK_LABELS.map((label, col) => (
        <Text key={`ml-${col}`} style={[s.calLabel, { left: colX[col], top: 64 }]}>
          {label}
        </Text>
      ))}

      {rows.map((row, ri) => {
        if (ri >= ROW_Y.length) return null;
        const ry = ROW_Y[ri];

        const qualSet = qualifyingSet;
        const actOrQualSet = qualSet?.size
          ? new Set([...activitySet, ...qualSet])
          : activitySet;
        const runGroups = findRunGroups(row, (d) => dayISO(d), actOrQualSet);
        const runCols = new Set(runGroups.flatMap((g) =>
          Array.from({ length: g.end - g.start + 1 }, (_, k) => g.start + k),
        ));

        return (
          <React.Fragment key={`r-${ri}`}>
            {row.map((d, col) => {
              if (!d || runCols.has(col)) return null;
              return <View key={`mc-${ri}-${col}`} style={[s.dayCircle, { left: colX[col] - 2, top: ry }]} />;
            })}

            {runGroups.map((g, si) => {
              const { left, width } = pillGeometry(colX, g.start, g.end);
              return <GradPill key={`mp-${ri}-${si}`} left={left} top={ry} width={width} height={28} />;
            })}

            {row.map((d, col) => {
              if (!d) return null;
              const iso = dayISO(d);
              const isPast = iso <= today;
              const isQual = qualifyingSet?.has(iso) ?? false;
              if (isQual) {
                return (
                  <Image
                    key={`mn-${ri}-${col}`}
                    source={QUAL_ICON}
                    style={[s.qualIcon, { left: colX[col] + 4, top: ry + 6 }]}
                    resizeMode="contain"
                  />
                );
              }
              return (
                <Text
                  key={`mn-${ri}-${col}`}
                  style={[
                    s.calNum,
                    { left: colX[col] - 2, top: ry + 6 },
                    isPast ? s.calNumPast : s.calNumFuture,
                    runCols.has(col) ? s.calNumRun : null,
                  ]}
                >
                  {d}
                </Text>
              );
            })}
          </React.Fragment>
        );
      })}
    </>
  );

  if (bare) return <View style={{ flex: 1, overflow: 'hidden' }}>{inner}</View>;

  return (
    <GradientCardBorder style={s.monthCard} innerStyle={{ overflow: 'hidden' }} borderRadius={radius.md.borderRadius}>
      {inner}
    </GradientCardBorder>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  calCard: {
    flex: 1,
    ...radius.md,
  },
  monthCard: {
    flex: 1,
    ...radius.md,
  },
  monthHeader: {
    position: 'absolute',
    left: 24,
    top: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthArrow: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 16,
    height: 24,
  },
  monthTitle: {
    fontFamily: 'Formula1-Bold',
    fontSize: 20,
    lineHeight: 24,
    color: '#FFFFFF',
    includeFontPadding: false,
    marginLeft: 8,
  },
  calLabel: {
    position: 'absolute',
    top: 16,
    width: 24,
    height: 16,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    textAlign: 'center',
    color: '#FFFFFF',
    opacity: 0.3,
    includeFontPadding: false,
  },
  dayCircle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  calNum: {
    position: 'absolute',
    width: 28,
    height: 16,
    fontFamily: 'Formula1-Regular',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: -0.26,
    textAlign: 'center',
    color: '#FFFFFF',
    includeFontPadding: false,
  },
  calNumPast: {
    opacity: 1,
  },
  calNumFuture: {
    opacity: 0.3,
  },
  calNumRun: {
    fontFamily: 'Formula1-Bold',
  },
  qualIcon: {
    position: 'absolute',
    width: 16,
    height: 16,
  },
});
