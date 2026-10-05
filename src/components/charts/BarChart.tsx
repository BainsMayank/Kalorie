import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { barChartMax } from '@/lib/chart';
import { useTheme } from '@/theme';

export interface BarDatum {
  key: string;
  /** `null` = nothing logged: no bar. */
  value: number | null;
  color: string;
  /** Shown under the bar ("M", "14"); empty for none. */
  label?: string;
  /** The target that day: drawn as a dashed line across the bar's slot. */
  target?: number | null;
}

type Props = {
  bars: readonly BarDatum[];
  /** Read out instead of the chart ("Average 1,840 kcal…"). */
  accessibilityLabel: string;
  /** Formats the numbers on the side ("2,500"); without it (hide numbers) there are none. */
  formatValue?: (value: number) => string;
  height?: number;
};

const AXIS_WIDTH = 40;
const LABEL_HEIGHT = 18;

/**
 * A plain bar chart (SPEC §2.11: a bar per day, dashed target line), drawn with react-native-svg.
 * The chart itself is one image for screen readers; the numbers are in the text beside it.
 */
export function BarChart({ bars, accessibilityLabel, formatValue, height = 140 }: Props) {
  const { colors, fontSize } = useTheme();
  const [width, setWidth] = useState(0);
  const max = barChartMax(bars.flatMap((b) => [b.value, b.target ?? null]));
  const plotWidth = Math.max(0, width - AXIS_WIDTH);
  const slot = bars.length > 0 ? plotWidth / bars.length : 0;
  const barWidth = Math.max(2, Math.min(28, slot * 0.6));
  const y = (value: number) => height - (Math.max(0, value) / max) * height;
  const slotX = (i: number) => AXIS_WIDTH + i * slot;

  // Runs of days with the same target become one dashed line.
  const targetLines: { from: number; to: number; value: number }[] = [];
  bars.forEach((bar, i) => {
    const target = bar.target ?? null;
    const last = targetLines[targetLines.length - 1];
    if (target === null) return;
    if (last && last.value === target && last.to === i) last.to = i + 1;
    else targetLines.push({ from: i, to: i + 1, value: target });
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: height + LABEL_HEIGHT }}
    >
      {width > 0 && (
        <Svg width={width} height={height + LABEL_HEIGHT}>
          {formatValue &&
            [max, max / 2].map((value) => (
              <SvgText
                key={value}
                x={0}
                y={y(value) + 10}
                fontSize={fontSize.caption - 2}
                fill={colors.textSecondary}
              >
                {formatValue(value)}
              </SvgText>
            ))}
          {[max, max / 2, 0].map((value) => (
            <Line
              key={value}
              x1={AXIS_WIDTH}
              x2={width}
              y1={y(value)}
              y2={y(value)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {bars.map((bar, i) =>
            bar.value === null || bar.value <= 0 ? null : (
              <Rect
                key={bar.key}
                x={slotX(i) + (slot - barWidth) / 2}
                y={y(bar.value)}
                width={barWidth}
                height={height - y(bar.value)}
                rx={Math.min(3, barWidth / 3)}
                fill={bar.color}
              />
            ),
          )}
          {targetLines.map((line) => (
            <Line
              key={`${line.from}-${line.value}`}
              x1={slotX(line.from)}
              x2={slotX(line.to)}
              y1={y(line.value)}
              y2={y(line.value)}
              stroke={colors.text}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          ))}
          {bars.map((bar, i) =>
            bar.label ? (
              <SvgText
                key={`label-${bar.key}`}
                x={slotX(i) + slot / 2}
                y={height + LABEL_HEIGHT - 4}
                fontSize={fontSize.caption - 2}
                fill={colors.textSecondary}
                textAnchor="middle"
              >
                {bar.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
    </View>
  );
}
