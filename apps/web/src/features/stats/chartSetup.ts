import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type Plugin,
} from 'chart.js';
import { useMemo } from 'react';
import { cssVar, seriesColor, SERIES_LIGHT, useIsDark } from '../../lib/theme';
import { prefersReducedMotion } from '../../lib/motion';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
);

export interface ChartTheme {
  dark: boolean;
  text: string;
  text2: string;
  grid: string;
  surface: string;
  tooltipBg: string;
  /** Categorical slot i in the current mode. */
  slot: (i: number) => string;
  /** A car's identity colour in the current mode. */
  car: (hex: string) => string;
}

/** Theme colours read from CSS variables; recomputed when light/dark changes. */
export function useChartTheme(): ChartTheme {
  const dark = useIsDark();
  return useMemo(() => {
    // Read after the theme attribute/media has applied.
    const text = cssVar('--label') || (dark ? '#fff' : '#000');
    return {
      dark,
      text,
      text2: cssVar('--label-2'),
      grid: cssVar('--grid'),
      surface: cssVar('--surface'),
      tooltipBg: dark ? 'rgba(58,58,60,0.97)' : 'rgba(255,255,255,0.98)',
      slot: (i: number) => seriesColor(SERIES_LIGHT[i % SERIES_LIGHT.length]!, dark),
      car: (hex: string) => seriesColor(hex, dark),
    };
  }, [dark]);
}

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif';

/** Shared base options: recessive grid, no axis lines, readable tooltip. */
// Chart.js option generics don't compose across chart types; charts cast to their own type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LooseOptions = any;

export function baseOptions(t: ChartTheme, opts: { legend?: boolean } = {}): LooseOptions {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: prefersReducedMotion() ? false : { duration: 450, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    layout: { padding: { top: 4, right: 4 } },
    font: { family: FONT },
    plugins: {
      legend: {
        display: opts.legend ?? false,
        position: 'top',
        align: 'start',
        labels: {
          color: t.text2,
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          font: { family: FONT, size: 12 },
        },
      },
      tooltip: {
        backgroundColor: t.tooltipBg,
        titleColor: t.text,
        bodyColor: t.text,
        borderColor: t.grid,
        borderWidth: 1,
        padding: 10,
        cornerRadius: 10,
        boxPadding: 4,
        usePointStyle: true,
        titleFont: { family: FONT, size: 13, weight: 600 },
        bodyFont: { family: FONT, size: 13 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: t.text2,
          font: { family: FONT, size: 11 },
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        grid: { color: t.grid },
        border: { display: false },
        ticks: { color: t.text2, font: { family: FONT, size: 11 }, maxTicksLimit: 5, padding: 6 },
      },
    },
  };
}

/** Vertical hairline at the hovered x (line charts). */
export const crosshair: Plugin<'line'> = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length) return;
    const x = active[0]!.element.x;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = (chart.options.scales?.y?.grid?.color as string) ?? 'rgba(128,128,128,0.3)';
    ctx.stroke();
    ctx.restore();
  },
};

/** Value at the end of each horizontal bar (station chart). */
export function barEndLabels(format: (v: number) => string, color: string): Plugin<'bar'> {
  return {
    id: 'barEndLabels',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx;
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `500 12px ${FONT}`;
      ctx.textBaseline = 'middle';
      chart.getDatasetMeta(0).data.forEach((bar, i) => {
        const v = chart.data.datasets[0]!.data[i] as number;
        if (v == null) return;
        ctx.fillText(format(v), (bar as unknown as { x: number }).x + 6, bar.y);
      });
      ctx.restore();
    },
  };
}
