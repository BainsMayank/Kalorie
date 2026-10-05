import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { fraction } from '@/lib/chart';
import { useTheme } from '@/theme';

export interface LinePoint {
  /** Days from the start of the chart (0 = first day). */
  x: number;
  y: number;
}

export interface LineSeries {
  key: string;
  color: string;
  points: readonly LinePoint[];
  /** Draw a line through the points. */
  line?: boolean;
  /** Draw a dot on each point (radius; 0 = none). */
  dot?: number;
  /** Don't join points more than one day apart (a day with nothing logged). */
  breakGaps?: boolean;
  /** Faded, for raw values behind a trend. */
  faded?: boolean;
}

type Props = {
  series: readonly LineSeries[];
  /** Days shown: x runs from 0 to `days − 1`. */
  days: number;
  min: number;
  max: number;
  /** Labels under the chart, at a day's x. */
  xLabels: readonly { x: number; text: string }[];
  /** Formats the numbers on the side; without it (hide numbers) there are none. */
  formatValue?: (value: number) => string;
  /** Read out instead of the chart. */
  accessibilityLabel: string;
  height?: number;
};

const AXIS_WIDTH = 40;
const LABEL_HEIGHT = 18;
const PAD = 6; // room so dots at the edges aren't cut off
const END_PAD = 16; // room for the last day's label, which is centred on its day

/** Splits points into runs of consecutive days. */
function runs(points: readonly LinePoint[], breakGaps: boolean): LinePoint[][] {
  const result: LinePoint[][] = [];
  for (const point of points) {
    const run = result[result.length - 1];
    if (run && (!breakGaps || point.x - run[run.length - 1].x <= 1)) run.push(point);
    else result.push([point]);
  }
  return result;
}

/**
 * A line chart over days, drawn with react-native-svg: weight dots with their trend line
 * (SPEC §2.11), or protein / carbs / fat per day. x is placed by day, so gaps stay gaps.
 */
export function LineChart({
  series,
  days,
  min,
  max,
  xLabels,
  formatValue,
  accessibilityLabel,
  height = 140,
}: Props) {
  const { colors, fontSize } = useTheme();
  const [width, setWidth] = useState(0);
  const plotLeft = AXIS_WIDTH + PAD;
  const plotWidth = Math.max(0, width - plotLeft - END_PAD);
  const x = (day: number) =>
    plotLeft + (days <= 1 ? plotWidth / 2 : (day / (days - 1)) * plotWidth);
  const y = (value: number) => PAD + (1 - fraction(value, min, max)) * (height - 2 * PAD);

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
          {[max, (min + max) / 2, min].map((value) => (
            <Line
              key={`grid-${value}`}
              x1={AXIS_WIDTH}
              x2={width}
              y1={y(value)}
              y2={y(value)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {formatValue &&
            [max, min].map((value) => (
              <SvgText
                key={`axis-${value}`}
                x={0}
                y={y(value) + 4}
                fontSize={fontSize.caption - 2}
                fill={colors.textSecondary}
              >
                {formatValue(value)}
              </SvgText>
            ))}
          {series.map((s) => (
            <SeriesMarks key={s.key} series={s} x={x} y={y} />
          ))}
          {xLabels.map((label) => (
            <SvgText
              key={`x-${label.x}`}
              x={x(label.x)}
              y={height + LABEL_HEIGHT - 4}
              fontSize={fontSize.caption - 2}
              fill={colors.textSecondary}
              textAnchor="middle"
            >
              {label.text}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

function SeriesMarks({
  series,
  x,
  y,
}: {
  series: LineSeries;
  x: (day: number) => number;
  y: (value: number) => number;
}) {
  const opacity = series.faded ? 0.45 : 1;
  return (
    <>
      {series.line &&
        runs(series.points, series.breakGaps ?? false)
          .filter((run) => run.length > 1)
          .map((run) => (
            <Polyline
              key={`line-${run[0].x}`}
              points={run.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')}
              fill="none"
              stroke={series.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              opacity={opacity}
            />
          ))}
      {(series.dot ?? 0) > 0 &&
        series.points.map((p) => (
          <Circle
            key={`dot-${p.x}`}
            cx={x(p.x)}
            cy={y(p.y)}
            r={series.dot}
            fill={series.color}
            opacity={opacity}
          />
        ))}
    </>
  );
}
