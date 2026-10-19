import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import {
  formatCostPerKm,
  formatCurrency,
  formatDate,
  formatKm,
  formatL100,
  formatPricePerLiter,
  formatPct,
} from '@fuel/shared';
import { Page } from '../../components/ui/Page';
import { CarSwitcher } from '../../components/ui/CarSwitcher';
import { SyncIndicator } from '../../components/ui/SyncIndicator';
import { BUDGET_LABEL, Delta, Ring, StatCard, StatusBadge } from '../../components/ui/Stats';
import { Row, Section } from '../../components/ui/List';
import { Icon } from '../../components/ui/Icon';
import { Button } from '../../components/ui/Controls';
import { EmptyState } from '../../components/ui/EmptyState';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { SwipeRow } from '../../components/ui/SwipeRow';
import { toast } from '../../components/ui/Toast';
import { addSheet, canEditRecord, isAdmin, useCarSelection, useMe } from '../../app/context';
import {
  useBudgets,
  useExpenses,
  useFillups,
  useOdometerReadings,
  useReminders,
  useUserNames,
} from '../../data/hooks';
import { syncNow } from '../../data/sync';
import { softDelete } from '../../data/mutations';
import { useDashboard } from './useDashboard';
import { RecordRowContent } from '../history/RecordRow';
import { InstallBanner } from './InstallBanner';
import { FUEL_COLOR } from '../labels';

export function HomePage() {
  const me = useMe();
  const { cars, selection, setSelection, selectedCars, carIds } = useCarSelection();
  const fillups = useFillups(carIds);
  const expenses = useExpenses(carIds);
  const readings = useOdometerReadings(carIds);
  const reminders = useReminders(carIds);
  const budgets = useBudgets();
  const names = useUserNames();
  const isAll = selection === 'all';
  const d = useDashboard({
    cars,
    selectedCars,
    isAll,
    fillups,
    expenses,
    readings,
    reminders,
    budgets,
  });
  const refresh = useCallback(() => syncNow(), []);
  const [showAllReminders, setShowAllReminders] = useState(false);

  if (cars.length === 0) {
    return (
      <Page title="Home" large>
        <InstallBanner />
        <EmptyState
          icon="car"
          title="Welcome!"
          message="Start by adding your family's car. Then tap + at the pump to log each fill-up."
          action={
            <Link to="/more/cars/new">
              <Button>Add your first car</Button>
            </Link>
          }
        />
      </Page>
    );
  }

  const c = d.comparisons;
  const upcoming = d.reminders.filter((r) => r.status !== 'ok');
  const shownReminders = showAllReminders ? upcoming : upcoming.slice(0, 3);

  return (
    <PullToRefresh onRefresh={refresh}>
      <Page
        title={isAll ? 'All cars' : (selectedCars[0]?.name ?? 'Home')}
        large
        wide
        titleNode={<CarSwitcher cars={cars} value={selection!} onChange={setSelection} />}
        accessory={
          <div className="-ml-2 mt-0.5">
            <SyncIndicator />
          </div>
        }
      >
        <InstallBanner />
        {!d.hasData ? (
          <EmptyState
            icon="fuel"
            title="No fill-ups yet"
            message="Tap + to log your first one. It only takes a few seconds at the pump."
            action={<Button onClick={() => addSheet.open('fillup')}>Log a fill-up</Button>}
          />
        ) : (
          <div className="grid grid-cols-1 gap-x-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="min-w-0">
              <h2 className="sr-only">This month</h2>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
                <div className="col-span-2 sm:col-span-1">
                  <StatCard
                    label="Fuel this month"
                    icon={<Icon name="fuel" size={17} />}
                    tint={FUEL_COLOR}
                    value={formatCurrency(d.current.fuelCost)}
                    delta={<Delta d={c.fuelCost.vsLastMonth} suffix="vs last month" />}
                    sub={
                      c.fuelCost.vsLastMonth.direction == null
                        ? `${d.current.fillupCount} fill-ups`
                        : undefined
                    }
                  />
                </div>
                <StatCard
                  label="Km this month"
                  icon={<Icon name="road" size={17} />}
                  value={formatKm(d.current.km)}
                  delta={<Delta d={c.km.vsLastMonth} compact />}
                />
                <StatCard
                  label="Economy"
                  icon={<Icon name="gauge" size={17} />}
                  value={formatL100(d.l100)}
                  delta={!d.l100IsAllTime ? <Delta d={c.l100.vs3MonthAvg} compact /> : undefined}
                  sub={d.l100IsAllTime ? 'all-time' : 'vs 3-mo avg'}
                />
                <StatCard
                  label="Avg price"
                  icon={<Icon name="euro" size={17} />}
                  value={formatPricePerLiter(d.pricePerLiter)}
                  delta={
                    !d.priceIsAllTime ? (
                      <Delta d={c.avgPricePerLiter.vs3MonthAvg} compact />
                    ) : undefined
                  }
                  sub={d.priceIsAllTime ? 'all-time' : 'vs 3-mo avg'}
                />
                <StatCard
                  label="True cost / km"
                  icon={<Icon name="wallet" size={17} />}
                  value={formatCostPerKm(d.current.trueCostPerKm)}
                  sub="fuel + expenses"
                />
              </div>

              <Section header="Spending">
                <div className="flex items-center gap-4 p-4">
                  {d.budgetState ? (
                    <Ring ratio={d.budgetState.ratio} status={d.budgetState.status}>
                      <span className="text-headline tabular">
                        {formatPct(d.budgetState.ratio)}
                      </span>
                      <span className="text-caption-2 text-label-2">of budget</span>
                    </Ring>
                  ) : (
                    <Ring ratio={0} status="ok">
                      <Icon name="wallet" size={26} className="text-label-3" />
                    </Ring>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-title-3 tabular">{formatCurrency(d.current.totalCost)}</p>
                    <p className="text-subhead text-label-2">
                      spent this month
                      {d.budgetState && (
                        <> of {formatCurrency(d.budgetState.budget, { whole: true })}</>
                      )}
                    </p>
                    {d.budgetState ? (
                      <p
                        className={`mt-1 inline-flex items-center gap-1 text-footnote font-semibold ${
                          d.budgetState.status === 'ok'
                            ? 'text-green-text'
                            : d.budgetState.status === 'warning'
                              ? 'text-orange-text'
                              : 'text-red-text'
                        }`}
                      >
                        <Icon
                          name={d.budgetState.status === 'ok' ? 'check' : 'warning'}
                          size={14}
                          strokeWidth={2.6}
                        />
                        {BUDGET_LABEL[d.budgetState.status]}
                        {d.budgetState.remaining >= 0 && (
                          <span className="font-normal text-label-2">
                            {' '}
                            · {formatCurrency(d.budgetState.remaining, { whole: true })} left
                          </span>
                        )}
                      </p>
                    ) : (
                      isAdmin(me) && (
                        <Link
                          to="/more/budget"
                          className="mt-1 inline-block text-footnote text-accent-text"
                        >
                          Set a monthly budget
                        </Link>
                      )
                    )}
                  </div>
                </div>
                <div className="row-inner ml-4 py-3 pr-4 text-subhead">
                  <span className="text-label-2">At this pace: </span>
                  <span className="font-semibold tabular">
                    ~{formatCurrency(d.projection.projected, { whole: true })}
                  </span>
                  <span className="text-label-2"> this month · </span>
                  <span className="font-semibold tabular">
                    ~{formatCurrency(d.yearProjection.projected, { whole: true })}
                  </span>
                  <span className="text-label-2"> this year</span>
                </div>
              </Section>
            </div>

            <div className="min-w-0">
              {upcoming.length > 0 && (
                <Section header="Reminders">
                  {shownReminders.map((r) => (
                    <Row
                      key={r.reminder.id}
                      to={`/more/reminders/${r.reminder.id}`}
                      title={r.reminder.title}
                      subtitle={reminderSubtitle(
                        r,
                        isAll ? cars.find((x) => x.id === r.reminder.carId)?.name : undefined,
                      )}
                      trailing={<StatusBadge status={r.status} />}
                    />
                  ))}
                  {upcoming.length > 3 && !showAllReminders && (
                    <Row
                      title={`Show all ${upcoming.length}`}
                      accent
                      onClick={() => setShowAllReminders(true)}
                    />
                  )}
                </Section>
              )}

              {d.odometer && (
                <Section header="Odometer">
                  <Row
                    title={<span className="tabular">≈ {formatKm(d.odometer.km)}</span>}
                    subtitle={
                      d.odometer.base.source === 'start'
                        ? 'Estimated from trip km since the start'
                        : `Last real reading ${formatDate(d.odometer.base.date)}`
                    }
                    icon={{ name: 'gauge', color: '#8e8e93' }}
                    trailing={<span className="text-subhead text-accent-text">Update</span>}
                    chevron={false}
                    onClick={() => addSheet.open('odometer')}
                    ariaLabel={`Estimated odometer ${formatKm(d.odometer.km)}. Update with a real reading`}
                  />
                </Section>
              )}

              {d.recentFillups.length > 0 && (
                <Section
                  header={
                    <span className="flex justify-between">
                      Recent fill-ups{' '}
                      <Link to="/history" className="text-accent-text normal-case">
                        See all
                      </Link>
                    </span>
                  }
                >
                  {d.recentFillups.map((f) => {
                    const car = cars.find((x) => x.id === f.carId);
                    return (
                      <SwipeRow
                        key={f.id}
                        disabled={!canEditRecord(me, f)}
                        onTap={() => addSheet.edit({ kind: 'fillup', record: f })}
                        onDelete={async () => {
                          const undo = await softDelete('fillups', f.id);
                          toast({
                            message: 'Fill-up deleted',
                            action: { label: 'Undo', run: undo },
                          });
                        }}
                      >
                        <div className="row-inner">
                          <RecordRowContent
                            item={{ kind: 'fillup', record: f }}
                            car={car}
                            carIndex={car ? cars.indexOf(car) : 0}
                            showCar={isAll}
                            loggedBy={names.get(f.createdBy)}
                          />
                        </div>
                      </SwipeRow>
                    );
                  })}
                </Section>
              )}
            </div>
          </div>
        )}
      </Page>
    </PullToRefresh>
  );
}

function reminderSubtitle(
  r: ReturnType<typeof useDashboard>['reminders'][number],
  carName?: string,
) {
  const parts: string[] = [];
  if (carName) parts.push(carName);
  if (r.kmRemaining != null) {
    parts.push(
      r.kmRemaining < 0 ? `${formatKm(-r.kmRemaining)} overdue` : `in ${formatKm(r.kmRemaining)}`,
    );
  }
  if (r.daysRemaining != null) {
    parts.push(
      r.daysRemaining < 0
        ? `${-r.daysRemaining} days overdue`
        : r.daysRemaining === 0
          ? 'due today'
          : `due ${formatDate(r.nextDueDate)}`,
    );
  } else if (r.estimatedKmDueDate) parts.push(`≈ ${formatDate(r.estimatedKmDueDate)}`);
  return parts.join(' · ');
}
