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
  type ScriptableContext,
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
  /** Colour for a measure when the chart shows one car (matches the UI tones). */
  metric: (m: Metric) => string;
}

/**
 * Measure → categorical slot. Mirrors TONE in lib/palette.ts (fuel orange, distance blue,
 * economy green-teal, price purple, cost pink) using the validated chart steps.
 */
const METRIC_SLOT = { distance: 0, fuel: 1, economy: 2, cost: 4, price: 6 } as const;
export type Metric = keyof typeof METRIC_SLOT;

/** Stacked spending series: fuel first (orange), then the expense groups. */
export const SPEND_SLOTS = [1, 0, 2, 3, 4] as const;

export const withAlpha = (hex: string, a: number) =>
  /^#[0-9a-f]{6}$/i.test(hex)
    ? hex +
      Math.round(a * 255)
        .toString(16)
        .padStart(2, '0')
    : hex;

/** Vertical wash under a line, fading to transparent at the baseline. */
export function areaFill(color: string, strength: number) {
  return (ctx: ScriptableContext<'line'>) => {
    const area = ctx.chart.chartArea;
    if (!area) return 'transparent';
    const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, withAlpha(color, strength));
    g.addColorStop(1, withAlpha(color, 0));
    return g;
  };
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
      tooltipBg: dark ? 'rgba(46,52,66,0.97)' : 'rgba(255,255,255,0.98)',
      slot: (i: number) => seriesColor(SERIES_LIGHT[i % SERIES_LIGHT.length]!, dark),
      car: (hex: string) => seriesColor(hex, dark),
      metric: (m: Metric) => seriesColor(SERIES_LIGHT[METRIC_SLOT[m]]!, dark),
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
          // A filled line's legend swatch uses its line colour, not the faded area gradient.
          generateLabels: (chart: Chart) =>
            Chart.defaults.plugins.legend.labels.generateLabels(chart).map((l) => {
              const ds = chart.data.datasets[l.datasetIndex ?? -1] as
                { fill?: unknown; borderColor?: unknown } | undefined;
              if (ds?.fill && typeof ds.borderColor === 'string') l.fillStyle = ds.borderColor;
              return l;
            }),
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
