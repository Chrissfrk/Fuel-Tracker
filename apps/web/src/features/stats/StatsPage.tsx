import { useState, type ReactNode } from 'react';
import {
  formatCostPerKm,
  formatCurrency,
  formatDate,
  formatKm,
  formatL100,
  formatLiters,
  formatMonth,
  formatPricePerLiter,
  type Delta as DeltaT,
} from '@fuel/shared';
import { Page } from '../../components/ui/Page';
import { CarSwitcher } from '../../components/ui/CarSwitcher';
import { Segmented } from '../../components/ui/Controls';
import { Delta, StatCard } from '../../components/ui/Stats';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon, type IconName } from '../../components/ui/Icon';
import { hueStyle, TONE, type Hue } from '../../lib/palette';
import { useCarSelection } from '../../app/context';
import { useCars, useExpenses, useFillups } from '../../data/hooks';
import { useStats, type Range } from './useStats';
import {
  CategoryDoughnut,
  EconomyChart,
  KmChart,
  PriceChart,
  SeasonalChart,
  SpendChart,
  StationChart,
} from './Charts';

const RANGES = [
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
] as const;

function ChartCard({
  title,
  subtitle,
  children,
  height = 220,
  empty,
  icon,
  tone,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number;
  empty?: boolean;
  icon: IconName;
  tone: Hue;
}) {
  return (
    <section className="tone-card mt-4 rounded-2xl p-4" aria-label={title} style={hueStyle(tone)}>
      <div className="flex items-start gap-2.5">
        <span className="tone-icon mt-0.5 h-8 w-8 rounded-[9px]">
          <Icon name={icon} size={18} strokeWidth={2.1} />
        </span>
        <div className="min-w-0">
          <h2 className="text-headline">{title}</h2>
          {subtitle && <p className="text-footnote text-label-2">{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <p className="py-10 text-center text-subhead text-label-2">
          Not enough data in this range yet.
        </p>
      ) : (
        <div
          className="mt-3"
          style={{ height }}
          role="img"
          aria-label={`${title} chart. The same figures are in the monthly table.`}
        >
          {children}
        </div>
      )}
    </section>
  );
}

const Arrow = ({ d }: { d: DeltaT }) => <Delta d={d} compact />;

export default function StatsPage() {
  const { cars, selection, setSelection, selectedCars, carIds } = useCarSelection();
  const allCars = useCars();
  const fillups = useFillups(carIds);
  const expenses = useExpenses(carIds);
  const [range, setRange] = useState<Range>('1y');
  const s = useStats(selectedCars, fillups, expenses, range);

  if (cars.length === 0 || selection == null) {
    return (
      <Page title="Stats" large>
        <EmptyState
          icon="stats"
          title="No stats yet"
          message="Add a car and log a few fill-ups to see your monthly figures and charts."
        />
      </Page>
    );
  }

  return (
    <Page
      title="Stats"
      large
      wide
      titleNode={<CarSwitcher cars={cars} value={selection} onChange={setSelection} />}
    >
      <div className="mt-1 max-w-sm">
        <Segmented
          label="Time range"
          options={RANGES}
          value={range}
          onChange={setRange}
          size="sm"
        />
      </div>

      {!s.hasData ? (
        <EmptyState
          icon="fuel"
          title="No fill-ups yet"
          message="Tap + to log your first one. Charts appear once there's data."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-x-4 lg:grid-cols-2 [&>*]:min-w-0">
            <ChartCard
              title="Fuel economy"
              subtitle="L/100 km for each full tank, with a 5-tank rolling average"
              icon="gauge"
              tone={TONE.economy}
              empty={s.economy.length === 0}
            >
              <EconomyChart points={s.economy} cars={selectedCars} allCars={allCars} />
            </ChartCard>
            <ChartCard
              title="Price per liter"
              subtitle="Each fill-up"
              icon="euro"
              tone={TONE.price}
              empty={s.prices.length === 0}
            >
              <PriceChart prices={s.prices} cars={selectedCars} allCars={allCars} />
            </ChartCard>
            <ChartCard
              title="Monthly spending"
              subtitle="Fuel and other expenses"
              icon="wallet"
              tone={TONE.cost}
              empty={s.spend.every(
                (r) => r.fuel === 0 && r.maintenance + r.fees + r.driving + r.other === 0,
              )}
              height={240}
            >
              <SpendChart rows={s.spend} />
            </ChartCard>
            <ChartCard
              title="Distance per month"
              icon="road"
              tone={TONE.distance}
              empty={s.kmByCar.every((r) => r.total === 0)}
            >
              <KmChart rows={s.kmByCar} cars={selectedCars} allCars={allCars} />
            </ChartCard>
            <ChartCard
              title="Seasonal economy"
              subtitle="Average L/100 km by calendar month, all years — A/C shows up in summer"
              icon="sun"
              tone={TONE.economy}
              empty={s.seasonal.every((p) => p.l100 == null)}
            >
              <SeasonalChart points={s.seasonal} />
            </ChartCard>
            <ChartCard
              title="Stations"
              subtitle="Average price per liter (cheapest first)"
              icon="fuel"
              tone={TONE.price}
              empty={s.stations.length === 0}
              height={Math.max(140, s.stations.length * 34)}
            >
              <StationChart stations={s.stations} />
            </ChartCard>
          </div>
          <section
            className="tone-card mt-4 rounded-2xl p-4"
            style={hueStyle(TONE.cost)}
            aria-label="Spending by category"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <span className="tone-icon h-8 w-8 rounded-[9px]">
                <Icon name="receipt" size={18} strokeWidth={2.1} />
              </span>
              <h2 className="text-headline">Spending by category</h2>
            </div>
            <CategoryDoughnut totals={s.categoryTotals} />
          </section>

          <MonthlyTable rows={s.table} />

          <h2 className="mt-8 mb-2 px-1 text-title-3">All time</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
            <StatCard
              label="Distance"
              icon="road"
              tone={TONE.distance}
              value={formatKm(s.allTime.km)}
              sub={s.allTime.firstDate ? `since ${formatDate(s.allTime.firstDate)}` : undefined}
            />
            <StatCard
              label="Total spent"
              icon="wallet"
              tone={TONE.cost}
              value={formatCurrency(s.allTime.totalCost, { whole: true })}
              sub={`${formatCurrency(s.allTime.fuelCost, { whole: true })} fuel`}
            />
            <StatCard
              label="Other expenses"
              icon="wrench"
              tone={TONE.cost}
              value={formatCurrency(s.allTime.expensesTotal, { whole: true })}
            />
            <StatCard
              label="Average economy"
              icon="gauge"
              tone={TONE.economy}
              value={formatL100(s.allTime.l100)}
              sub={
                s.allTime.kmPerL
                  ? `${s.allTime.kmPerL.toFixed(1).replace('.', ',')} km/L`
                  : undefined
              }
            />
            <StatCard
              label="Best tank"
              icon="sparkle"
              tone={TONE.economy}
              value={formatL100(s.allTime.bestSegment?.l100)}
              sub={s.allTime.bestSegment ? formatDate(s.allTime.bestSegment.endDate) : undefined}
            />
            <StatCard
              label="Worst tank"
              icon="arrowUp"
              tone={TONE.economy}
              value={formatL100(s.allTime.worstSegment?.l100)}
              sub={s.allTime.worstSegment ? formatDate(s.allTime.worstSegment.endDate) : undefined}
            />
            <StatCard
              label="Cheapest fuel"
              icon="arrowDown"
              tone={TONE.price}
              value={formatPricePerLiter(s.allTime.cheapestFill?.pricePerLiter)}
              sub={
                s.allTime.cheapestFill
                  ? [formatDate(s.allTime.cheapestFill.date), s.allTime.cheapestFill.station]
                      .filter(Boolean)
                      .join(' · ')
                  : undefined
              }
            />
            <StatCard
              label="Priciest fuel"
              icon="arrowUp"
              tone={TONE.price}
              value={formatPricePerLiter(s.allTime.priciestFill?.pricePerLiter)}
              sub={
                s.allTime.priciestFill
                  ? [formatDate(s.allTime.priciestFill.date), s.allTime.priciestFill.station]
                      .filter(Boolean)
                      .join(' · ')
                  : undefined
              }
            />
            <StatCard
              label="Per month"
              icon="calendar"
              tone={TONE.cost}
              value={formatCurrency(s.allTime.avgMonthlySpend, { whole: true })}
              sub="average spend"
            />
            <StatCard
              label="True cost / km"
              icon="wallet"
              tone={TONE.cost}
              value={formatCostPerKm(s.allTime.trueCostPerKm)}
              sub="fuel + expenses"
            />
            <StatCard
              label="Fuel bought"
              icon="fuel"
              tone={TONE.fuel}
              value={formatLiters(Math.round(s.allTime.liters))}
              sub={`${s.allTime.fillupCount} fill-ups`}
            />
            <StatCard
              label="Avg price"
              icon="euro"
              tone={TONE.price}
              value={formatPricePerLiter(s.allTime.avgPricePerLiter)}
            />
          </div>
        </>
      )}
    </Page>
  );
}

function MonthlyTable({ rows }: { rows: ReturnType<typeof useStats>['table'] }) {
  return (
    <section className="mt-6" aria-labelledby="monthly-h">
      <h2 id="monthly-h" className="mb-2 px-1 text-title-3">
        Month by month
      </h2>
      <div
        className="overflow-x-auto rounded-2xl bg-surface"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <table className="w-full min-w-[760px] text-subhead tabular">
          <thead className="text-left text-footnote text-label-2">
            <tr>
              <th scope="col" className="sticky left-0 bg-surface px-4 py-2.5 font-medium">
                Month
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Km
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Liters
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Fuel
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Expenses
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Total
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                €/L
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                L/100 km
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                Fill-ups
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.month} className="border-t-[0.5px] border-separator">
                <th
                  scope="row"
                  className="sticky left-0 bg-surface px-4 py-2.5 text-left font-medium whitespace-nowrap"
                >
                  {formatMonth(m.month, { short: true })}
                </th>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {m.km ? formatKm(m.km) : '–'}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {m.liters ? formatLiters(Math.round(m.liters * 10) / 10) : '–'}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {formatCurrency(m.fuelCost)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {formatCurrency(m.expensesTotal)}
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <span className="font-semibold">{formatCurrency(m.totalCost)}</span>{' '}
                  <Arrow d={m.totalVsLast} />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {formatPricePerLiter(m.avgPricePerLiter).replace(' €/L', '')}{' '}
                  <Arrow d={m.pplVsLast} />
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  {m.l100 != null ? formatL100(m.l100).replace(' L/100 km', '') : '–'}{' '}
                  <Arrow d={m.l100VsLast} />
                </td>
                <td className="px-4 py-2.5 text-right">{m.fillupCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 px-1 text-footnote text-label-2">
        Arrows compare with the previous month. Green is better, red is worse.
      </p>
    </section>
  );
}
