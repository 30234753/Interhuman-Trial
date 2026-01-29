'use client';

import { useMemo } from 'react';

export interface RadarDataPoint {
  id: string;
  label: string;
  value: number; // 0–100
}

export interface EmotionalRadarChartProps {
  data: RadarDataPoint[];
  size?: number;
  className?: string;
  fillColor?: string;
  strokeColor?: string;
  labelColor?: string;
}

const DEFAULT_SIZE = 320;
const CENTER = 0.5;
const RADIUS = 0.38; // fraction of size for the outer ring (100%)
const LABEL_OFFSET = 0.48; // where labels sit

/**
 * Emotional radar chart: 5 axes (pentagon), one polygon for session scores.
 * Labels at axis ends. Adaptable to any 5 attributes via scenario selection.
 */
export default function EmotionalRadarChart({
  data,
  size = DEFAULT_SIZE,
  className = '',
  fillColor = '#6164F0',
  strokeColor = '#5442b3',
  labelColor = 'rgba(97, 100, 240, 0.95)',
}: EmotionalRadarChartProps) {
  const points = data.length === 5 ? data : [];
  const empty = points.length === 0;

  const { polygonPoints, axisLines, gridCircles, labels } = useMemo(() => {
    const n = 5;
    const cx = size * CENTER;
    const cy = size * CENTER;
    const maxR = size * RADIUS;
    const labelR = size * LABEL_OFFSET;

    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2; // top = first axis

    const axisLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const gridCircles: Array<{ r: number }> = [];
    const labels: Array<{ x: number; y: number; text: string }> = [];

    for (let i = 0; i < n; i++) {
      const angle = startAngle + i * angleStep;
      const ax = cx + maxR * Math.cos(angle);
      const ay = cy + maxR * Math.sin(angle);
      axisLines.push({ x1: cx, y1: cy, x2: ax, y2: ay });
      const labelAngle = startAngle + i * angleStep;
      const lx = cx + labelR * Math.cos(labelAngle);
      const ly = cy + labelR * Math.sin(labelAngle);
      labels.push({
        x: lx,
        y: ly,
        text: points[i]?.label ?? `Axis ${i + 1}`,
      });
    }

    for (const pct of [25, 50, 75]) {
      gridCircles.push({ r: (maxR * pct) / 100 });
    }
    gridCircles.push({ r: maxR });

    const polygonPoints: Array<{ x: number; y: number }> = [];
    if (!empty) {
      for (let i = 0; i < n; i++) {
        const value = Math.max(0, Math.min(100, points[i].value));
        const r = (maxR * value) / 100;
        const angle = startAngle + i * angleStep;
        polygonPoints.push({
          x: cx + r * Math.cos(angle),
          y: cy + r * Math.sin(angle),
        });
      }
    }

    return { polygonPoints, axisLines, gridCircles, labels, cx, cy };
  }, [size, points]);

  const polygonD =
    polygonPoints.length === 5
      ? polygonPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z'
      : '';

  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible"
        aria-label="Emotional attributes radar chart"
      >
        <defs>
          <linearGradient id="radarFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={fillColor} stopOpacity="0.45" />
            <stop offset="100%" stopColor={fillColor} stopOpacity="0.12" />
          </linearGradient>
        </defs>

        {/* Grid circles (25, 50, 75, 100%) */}
        {gridCircles.map((g, i) => (
          <circle
            key={i}
            cx={size * CENTER}
            cy={size * CENTER}
            r={g.r}
            fill="none"
            stroke="rgba(97, 100, 240, 0.2)"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(97, 100, 240, 0.35)"
            strokeWidth="1"
          />
        ))}

        {/* Data polygon */}
        {!empty && polygonD && (
          <>
            <path
              d={polygonD}
              fill="url(#radarFill)"
              stroke={strokeColor}
              strokeWidth="2"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
            {polygonPoints.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r="4"
                fill={strokeColor}
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}
          </>
        )}

        {/* Labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={l.y}
            textAnchor={l.x >= size * CENTER ? 'start' : 'end'}
            dominantBaseline="middle"
            fill={labelColor}
            fontSize={size < 280 ? 10 : 12}
            fontWeight="600"
            className="pointer-events-none select-none"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}
