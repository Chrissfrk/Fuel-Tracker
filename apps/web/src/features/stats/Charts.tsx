import { Bar, Doughnut, Line } from 'react-chartjs-2';
import type { ChartData, TooltipItem } from 'chart.js';
import { format, parseISO } from 'date-fns';
import {
  EXPENSE_GROUPS,
  formatCurrency,
  formatKm,
  formatL100,
  formatMonth,
  formatNumber,
  formatPricePerLiter,
  monthName,
  type Car,
  type GroupStats,
  type RollingPoint,
  type SeasonalPoint,
} from '@fuel/shared';
import {
  areaFill,
  baseOptions,
  barEndLabels,
  crosshair,
  SPEND_SLOTS,
  useChartTheme,
  withAlpha,
  type ChartTheme,
  type LooseOptions,
  type Metric,
} from './chartSetup';
import { carColor } from '../../lib/theme';

const ts = (iso: string) => parseISO(iso).getTime();
const dateTick = (v: number | string) => format(new Date(Number(v)), 'MMM yy');
const merge = (a: LooseOptions, b: LooseOptions): LooseOptions => ({ ...a, ...b });

function timeScales(
  t: ChartTheme,
  y: (v: number) => string,
  datasets: { data: { x: number }[] }[],
) {
  const base = baseOptions(t).scales!;
  const xs = datasets.flatMap((d) => d.data.map((p) => p.x));
  return {
    x: {
      ...base.x,
      type: 'linear' as const,
      // Clamp to the data so the axis doesn't pad out to a "nice" date with nothing in it.
      min: xs.length ? Math.min(...xs) : undefined,
      max: xs.length ? Math.max(...xs) : undefined,
      ticks: { ...base.x!.ticks, callback: dateTick, maxTicksLimit: 6 },
    },
    y: { ...base.y, ticks: { ...base.y!.ticks, callback: (v: number | string) => y(Number(v)) } },
  };
}

/**
 * Several cars: each car keeps its identity colour. One car: the series is the measure itself,
 * so it takes the measure's colour (the same hue as its card and icon elsewhere).
 */
function colorsFor(cars: Car[], allCars: Car[], t: ChartTheme, metric: Metric) {
  if (cars.length === 1) return new Map([[cars[0]!.id, t.metric(metric)]]);
  return new Map(cars.map((c) => [c.id, t.car(carColor(c, allCars.indexOf(c)))]));
}

// ---------- L/100 km per segment + rolling average ----------

export function EconomyChart({
  points,
  cars,
  allCars,
}: {
  points: RollingPoint[];
  cars: Car[];
  allCars: Car[];
}) {
  const t = useChartTheme();
  const colors = colorsFor(cars, allCars, t, 'economy');
  const single = cars.length === 1;
  const datasets = cars.flatMap((c) => {
    const pts = points.filter((p) => p.segment.carId === c.id);
    if (pts.length === 0) return [];
    const color = colors.get(c.id)!;
    return [
      {
        label: cars.length > 1 ? `${c.name} · each tank` : 'Each tank',
        data: pts.map((p) => ({ x: ts(p.segment.endDate), y: p.segment.l100! })),
        borderColor: 'transparent',
        backgroundColor: single ? withAlpha(color, 0.6) : color,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
        showLine: false,
      },
      {
        label: cars.length > 1 ? `${c.name} · 5-tank average` : '5-tank average',
        data: pts.map((p) => ({ x: ts(p.segment.endDate), y: p.rollingL100 })),
        borderColor: color,
        backgroundColor: single ? areaFill(color, t.dark ? 0.32 : 0.22) : color,
        fill: single ? 'start' : false,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.35,
      },
    ];
  });
  const options = merge(baseOptions(t, { legend: true }), {
    scales: timeScales(t, (v) => formatNumber(v, 1, 1), datasets),
    interaction: { mode: 'nearest', intersect: false, axis: 'x' },
  });
  options.plugins!.tooltip!.callbacks = {
    title: (items: TooltipItem<'line'>[]) => format(new Date(items[0]!.parsed.x!), 'dd/MM/yyyy'),
    label: (i: TooltipItem<'line'>) => ` ${i.dataset.label}: ${formatL100(i.parsed.y)}`,
  };
  return <Line data={{ datasets } as ChartData<'line'>} options={options} plugins={[crosshair]} />;
}

// ---------- Price per liter over time ----------

export function PriceChart({
  prices,
  cars,
  allCars,
}: {
  prices: { carId: string; date: string; ppl: number }[];
  cars: Car[];
  allCars: Car[];
}) {
  const t = useChartTheme();
  const colors = colorsFor(cars, allCars, t, 'price');
  const single = cars.length === 1;
  const datasets = cars
    .map((c) => ({
      label: c.name,
      data: prices.filter((p) => p.carId === c.id).map((p) => ({ x: ts(p.date), y: p.ppl })),
      borderColor: colors.get(c.id),
      backgroundColor: single ? areaFill(colors.get(c.id)!, t.dark ? 0.32 : 0.2) : colors.get(c.id),
      pointBackgroundColor: colors.get(c.id),
      fill: single ? 'start' : false,
      borderWidth: 2,
      pointRadius: 2.5,
      pointHoverRadius: 5,
      tension: 0.3,
    }))
    .filter((d) => d.data.length > 0);
  const options = merge(baseOptions(t, { legend: datasets.length > 1 }), {
    scales: timeScales(t, (v) => formatNumber(v, 2, 2), datasets),
  });
  options.plugins!.tooltip!.callbacks = {
    title: (items: TooltipItem<'line'>[]) => format(new Date(items[0]!.parsed.x!), 'dd/MM/yyyy'),
    label: (i: TooltipItem<'line'>) =>
      ` ${datasets.length > 1 ? `${i.dataset.label}: ` : ''}${formatPricePerLiter(i.parsed.y)}`,
  };
  return <Line data={{ datasets } as ChartData<'line'>} options={options} plugins={[crosshair]} />;
}

// ---------- Monthly spend (stacked: fuel + expense groups) ----------

type SpendRow = { month: string; fuel: number } & Record<
  (typeof EXPENSE_GROUPS)[number]['key'],
  number
>;

export function SpendChart({ rows }: { rows: SpendRow[] }) {
  const t = useChartTheme();
  const series = [
    { key: 'fuel', label: 'Fuel' },
    ...EXPENSE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
  ] as const;
  const datasets = series
    .map((s, i) => ({
      label: s.label,
      data: rows.map((r) => r[s.key as keyof SpendRow] as number),
      backgroundColor: t.slot(SPEND_SLOTS[i]!),
      borderColor: t.surface,
      borderWidth: { top: 2 },
      borderRadius: 4,
      borderSkipped: 'start' as const,
      maxBarThickness: 28,
    }))
    .filter((d) => d.data.some((v) => v > 0));
  const options = baseOptions(t, { legend: true });
  options.scales!.x = { ...options.scales!.x, stacked: true };
  options.scales!.y = {
    ...options.scales!.y,
    stacked: true,
    ticks: {
      ...options.scales!.y!.ticks,
      callback: (v: number | string) => formatCurrency(Number(v), { whole: true }),
    },
  };
  options.plugins!.tooltip!.callbacks = {
    title: (items: TooltipItem<'bar'>[]) => formatMonth(rows[items[0]!.dataIndex]!.month),
    label: (i: TooltipItem<'bar'>) =>
      i.parsed.y ? ` ${i.dataset.label}: ${formatCurrency(i.parsed.y)}` : '',
    footer: (items: TooltipItem<'bar'>[]) =>
      `Total ${formatCurrency(items.reduce((s: number, i: TooltipItem<'bar'>) => s + (i.parsed.y ?? 0), 0))}`,
  };
  options.plugins!.tooltip!.filter = (i: TooltipItem<'bar'>) => (i.parsed.y ?? 0) > 0;
  return (
    <Bar
      data={{
        labels: rows.map((r) => formatMonth(r.month, { short: true, noYear: rows.length <= 12 })),
        datasets,
      }}
      options={options}
    />
  );
}

// ---------- Monthly km ----------

export function KmChart({
  rows,
  cars,
  allCars,
}: {
  rows: { month: string; perCar: Record<string, number> }[];
  cars: Car[];
  allCars: Car[];
}) {
  const t = useChartTheme();
  const colors = colorsFor(cars, allCars, t, 'distance');
  const datasets = cars.map((c) => ({
    label: c.name,
    data: rows.map((r) => r.perCar[c.id] ?? 0),
    backgroundColor: colors.get(c.id),
    borderColor: t.surface,
    borderWidth: cars.length > 1 ? { top: 2 } : 0,
    borderRadius: 4,
    borderSkipped: 'start' as const,
    maxBarThickness: 28,
  }));
  const options = baseOptions(t, { legend: cars.length > 1 });
  options.scales!.x = { ...options.scales!.x, stacked: true };
  options.scales!.y = {
    ...options.scales!.y,
    stacked: true,
    ticks: {
      ...options.scales!.y!.ticks,
      callback: (v: number | string) => formatNumber(Number(v)),
    },
  };
  options.plugins!.tooltip!.callbacks = {
    title: (items: TooltipItem<'bar'>[]) => formatMonth(rows[items[0]!.dataIndex]!.month),
    label: (i: TooltipItem<'bar'>) =>
      ` ${cars.length > 1 ? `${i.dataset.label}: ` : ''}${formatKm(i.parsed.y)}`,
  };
  return (
    <Bar
      data={{
        labels: rows.map((r) => formatMonth(r.month, { short: true, noYear: rows.length <= 12 })),
        datasets,
      }}
      options={options}
    />
  );
}

// ---------- Seasonal L/100 km ----------

export function SeasonalChart({ points }: { points: SeasonalPoint[] }) {
  const t = useChartTheme();
  const options = baseOptions(t);
  const known = points.map((p) => p.l100).filter((v): v is number => v != null);
  const min = known.length ? Math.max(0, Math.floor(Math.min(...known) - 1)) : 0;
  options.scales!.y = {
    ...options.scales!.y,
    min,
    ticks: {
      ...options.scales!.y!.ticks,
      callback: (v: number | string) => formatNumber(Number(v), 1, 0),
    },
  };
  options.plugins!.tooltip!.callbacks = {
    title: (items: TooltipItem<'bar'>[]) => monthName(points[items[0]!.dataIndex]!.month),
    label: (i: TooltipItem<'bar'>) => {
      const p = points[i.dataIndex]!;
      return p.l100 == null ? ' No full tanks' : ` ${formatL100(p.l100)} · ${p.segmentCount} tanks`;
    },
  };
  return (
    <Bar
      data={{
        labels: points.map((p) => monthName(p.month, true)),
        datasets: [
          {
            label: 'L/100 km',
            data: points.map((p) => p.l100),
            backgroundColor: t.metric('economy'),
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 22,
          },
        ],
      }}
      options={options}
    />
  );
}

// ---------- Spending by category (doughnut) ----------

export function CategoryDoughnut({
  totals,
}: {
  totals: { fuel: number } & Record<string, number>;
}) {
  const t = useChartTheme();
  const series = [
    { key: 'fuel', label: 'Fuel' },
    ...EXPENSE_GROUPS.map((g) => ({ key: g.key, label: g.label })),
  ];
  const rows = series
    .map((s, i) => ({ ...s, value: totals[s.key] ?? 0, color: t.slot(SPEND_SLOTS[i]!) }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <Doughnut
          data={{
            labels: rows.map((r) => r.label),
            datasets: [
              {
                data: rows.map((r) => r.value),
                backgroundColor: rows.map((r) => r.color),
                borderColor: t.surface,
                borderWidth: 2,
                hoverOffset: 4,
              },
            ],
          }}
          options={{
            cutout: '68%',
            responsive: true,
            maintainAspectRatio: false,
            animation: baseOptions(t).animation,
            plugins: {
              legend: { display: false },
              tooltip: {
                ...(baseOptions(t).plugins!.tooltip as object),
                callbacks: {
                  label: (i: TooltipItem<'doughnut'>) =>
                    ` ${i.label}: ${formatCurrency(i.parsed)} (${Math.round((i.parsed / total) * 100)}%)`,
                },
              },
            },
          }}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-headline tabular">{formatCurrency(total, { whole: true })}</span>
          <span className="text-caption text-label-2">total</span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2 text-subhead">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: r.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{r.label}</span>
            <span className="tabular">{formatCurrency(r.value, { whole: true })}</span>
            <span className="w-10 text-right text-label-2 tabular">
              {Math.round((r.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Station comparison ----------

export function StationChart({ stations }: { stations: GroupStats[] }) {
  const t = useChartTheme();
  const options = baseOptions(t);
  const values = stations.map((s) => s.avgPricePerLiter ?? 0);
  const min = Math.max(0, Math.floor((Math.min(...values) - 0.05) * 10) / 10);
  options.indexAxis = 'y';
  options.interaction = { mode: 'nearest', intersect: true, axis: 'y' };
  options.layout = { padding: { right: 64 } };
  options.scales = {
    x: {
      ...options.scales!.y,
      min,
      grace: '4%',
      ticks: {
        ...options.scales!.y!.ticks,
        callback: (v: number | string) => formatNumber(Number(v), 2, 2),
      },
    },
    y: {
      ...options.scales!.x,
      ticks: { ...options.scales!.x!.ticks, autoSkip: false, crossAlign: 'far' },
    },
  };
  options.plugins!.tooltip!.callbacks = {
    label: (i: TooltipItem<'bar'>) => {
      const s = stations[i.dataIndex]!;
      return [
        ` ${formatPricePerLiter(s.avgPricePerLiter)} average`,
        ` ${s.fillupCount} fill-ups${s.l100 != null ? ` · ${formatL100(s.l100)}` : ''}`,
      ];
    },
  };
  return (
    <Bar
      data={{
        labels: stations.map((s) => s.key),
        datasets: [
          {
            label: 'Average €/L',
            data: values,
            // Cheapest first and at full strength; the rest step back.
            backgroundColor: values.map((_, i) =>
              i === 0 ? t.metric('price') : withAlpha(t.metric('price'), 0.55),
            ),
            borderRadius: 4,
            borderSkipped: 'start',
            barThickness: 18,
          },
        ],
      }}
      options={options}
      plugins={[barEndLabels((v) => formatNumber(v, 3, 3), t.text2)]}
    />
  );
}
