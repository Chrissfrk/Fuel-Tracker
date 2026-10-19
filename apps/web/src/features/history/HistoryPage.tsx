import { useCallback, useMemo, useState } from 'react';
import {
  EXPENSE_CATEGORIES,
  filterHistory,
  formatCurrency,
  formatMonth,
  groupHistory,
  toHistoryItems,
  type ExpenseCategory,
  type HistoryFilter,
  type HistoryItem,
} from '@fuel/shared';
import { Page, BarButton } from '../../components/ui/Page';
import { Icon } from '../../components/ui/Icon';
import { Chip, Button, Segmented } from '../../components/ui/Controls';
import { EmptyState } from '../../components/ui/EmptyState';
import { SwipeRow } from '../../components/ui/SwipeRow';
import { Sheet } from '../../components/ui/Sheet';
import { FieldRow, Row, Section } from '../../components/ui/List';
import { CarDot } from '../../components/ui/CarSwitcher';
import { PullToRefresh } from '../../components/ui/PullToRefresh';
import { toast } from '../../components/ui/Toast';
import { addSheet, canEditRecord, useMe } from '../../app/context';
import {
  useCars,
  useExpenses,
  useFillups,
  useOdometerReadings,
  useUserNames,
  useUsers,
} from '../../data/hooks';
import { softDelete } from '../../data/mutations';
import { syncNow } from '../../data/sync';
import { carColor } from '../../lib/theme';
import { CATEGORY_META } from '../labels';
import { RecordRowContent } from './RecordRow';

type Kind = 'all' | HistoryItem['kind'];
const KINDS = [
  { value: 'all', label: 'All' },
  { value: 'fillup', label: 'Fill-ups' },
  { value: 'expense', label: 'Expenses' },
  { value: 'odometer', label: 'Odometer' },
] as const;

const TABLE = { fillup: 'fillups', expense: 'expenses', odometer: 'odometerReadings' } as const;

interface Filters {
  kind: Kind;
  carIds: string[];
  categories: ExpenseCategory[];
  createdBy: string | null;
  from: string;
  to: string;
}
const EMPTY_FILTERS: Filters = {
  kind: 'all',
  carIds: [],
  categories: [],
  createdBy: null,
  from: '',
  to: '',
};

export function HistoryPage() {
  const me = useMe();
  const cars = useCars({ includeArchived: true });
  const fillups = useFillups(null);
  const expenses = useExpenses(null);
  const readings = useOdometerReadings(null);
  const users = useUsers();
  const names = useUserNames();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const refresh = useCallback(() => syncNow(), []);

  const months = useMemo(() => {
    const items = toHistoryItems({ fillups, expenses, odometerReadings: readings });
    const f: HistoryFilter = {
      kinds: filters.kind === 'all' ? null : [filters.kind],
      carIds: filters.carIds,
      categories: filters.categories,
      createdBy: filters.createdBy,
      from: filters.from || null,
      to: filters.to || null,
      search,
    };
    return groupHistory(filterHistory(items, f));
  }, [fillups, expenses, readings, filters, search]);

  const activeCount =
    (filters.kind !== 'all' ? 1 : 0) +
    (filters.carIds.length ? 1 : 0) +
    (filters.categories.length ? 1 : 0) +
    (filters.createdBy ? 1 : 0) +
    (filters.from || filters.to ? 1 : 0);
  const carIndex = (id: string) => cars.findIndex((c) => c.id === id);
  const noRecords = fillups.length + expenses.length + readings.length === 0;

  return (
    <PullToRefresh onRefresh={refresh}>
      <Page
        title="History"
        large
        trailing={
          <BarButton
            onClick={() => setFilterOpen(true)}
            label={`Filters${activeCount ? `, ${activeCount} active` : ''}`}
          >
            <span className="relative">
              <Icon name="filter" size={24} />
              {activeCount > 0 && (
                <span className="absolute -top-1 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-caption-2 font-bold text-on-accent">
                  {activeCount}
                </span>
              )}
            </span>
          </BarButton>
        }
      >
        <div className="relative mt-1">
          <Icon
            name="search"
            size={18}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-label-2"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes and stations"
            aria-label="Search notes and stations"
            className="h-9 w-full rounded-[10px] bg-fill pr-3 pl-9 text-body outline-none placeholder:text-label-2"
          />
        </div>

        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
          {KINDS.map((k) => (
            <Chip
              key={k.value}
              active={filters.kind === k.value}
              onClick={() => setFilters({ ...filters, kind: k.value })}
            >
              {k.label}
            </Chip>
          ))}
          {cars.length > 1 &&
            cars.map((c, i) => {
              const on = filters.carIds.includes(c.id);
              return (
                <Chip
                  key={c.id}
                  active={on}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      carIds: on
                        ? filters.carIds.filter((x) => x !== c.id)
                        : [...filters.carIds, c.id],
                    })
                  }
                >
                  <CarDot color={carColor(c, i)} size={8} />
                  {c.name}
                </Chip>
              );
            })}
        </div>

        {noRecords ? (
          <EmptyState
            icon="history"
            title="No fill-ups yet"
            message="Tap + to log your first one."
          />
        ) : months.length === 0 ? (
          <EmptyState
            icon="search"
            title="Nothing matches"
            message="Try a different search or clear the filters."
            action={
              <Button
                size="md"
                variant="tinted"
                onClick={() => (setFilters(EMPTY_FILTERS), setSearch(''))}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          months.map((m) => (
            <section key={m.month} className="mt-6" aria-labelledby={`m-${m.month}`}>
              <h2 id={`m-${m.month}`} className="mb-1.5 flex items-baseline justify-between px-4">
                <span className="text-headline">{formatMonth(m.month)}</span>
                <span className="text-subhead text-label-2 tabular">{formatCurrency(m.total)}</span>
              </h2>
              <div className="list-group overflow-hidden rounded-xl bg-surface">
                {m.items.map((item) => {
                  const car = cars.find((c) => c.id === item.record.carId);
                  return (
                    <SwipeRow
                      key={item.record.id}
                      disabled={!canEditRecord(me, item.record)}
                      onTap={() =>
                        addSheet.edit({ kind: item.kind, record: item.record } as Parameters<
                          typeof addSheet.edit
                        >[0])
                      }
                      onDelete={async () => {
                        const undo = await softDelete(TABLE[item.kind], item.record.id);
                        toast({ message: 'Deleted', action: { label: 'Undo', run: undo } });
                      }}
                    >
                      <div className="row-inner">
                        <RecordRowContent
                          item={item}
                          car={car}
                          carIndex={car ? carIndex(car.id) : 0}
                          showCar={cars.length > 1}
                          loggedBy={names.get(item.record.createdBy)}
                        />
                      </div>
                    </SwipeRow>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </Page>

      <Sheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        label="Filters"
        header={
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-2 pb-3">
            <button
              type="button"
              className="pressable min-h-11 justify-self-start px-2 text-accent-text"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              Reset
            </button>
            <h2 className="text-headline">Filters</h2>
            <button
              type="button"
              className="pressable min-h-11 justify-self-end px-2 font-semibold text-accent-text"
              onClick={() => setFilterOpen(false)}
            >
              Done
            </button>
          </div>
        }
      >
        <div className="mt-2">
          <Segmented
            label="Type"
            options={KINDS}
            value={filters.kind}
            onChange={(k) => setFilters({ ...filters, kind: k })}
          />
        </div>
        {cars.length > 1 && (
          <Section header="Cars">
            {cars.map((c, i) => {
              const on = filters.carIds.includes(c.id);
              return (
                <Row
                  key={c.id}
                  title={c.name + (c.archived ? ' (archived)' : '')}
                  leading={<CarDot color={carColor(c, i)} size={12} />}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      carIds: on
                        ? filters.carIds.filter((x) => x !== c.id)
                        : [...filters.carIds, c.id],
                    })
                  }
                  chevron={false}
                  trailing={
                    on ? (
                      <Icon name="check" size={20} strokeWidth={2.6} className="text-accent" />
                    ) : null
                  }
                />
              );
            })}
          </Section>
        )}
        <Section header="Logged by">
          {[{ id: null, displayName: 'Anyone' }, ...users].map((u) => (
            <Row
              key={u.id ?? 'any'}
              title={u.displayName}
              onClick={() => setFilters({ ...filters, createdBy: u.id })}
              chevron={false}
              trailing={
                filters.createdBy === u.id ? (
                  <Icon name="check" size={20} strokeWidth={2.6} className="text-accent" />
                ) : null
              }
            />
          ))}
        </Section>
        <Section header="Expense category">
          <div className="flex flex-wrap gap-2 p-3">
            {EXPENSE_CATEGORIES.map((cat) => {
              const on = filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setFilters({
                      ...filters,
                      categories: on
                        ? filters.categories.filter((x) => x !== cat)
                        : [...filters.categories, cat],
                    })
                  }
                  className={`pressable min-h-9 rounded-full px-3 text-subhead ${on ? 'bg-accent text-on-accent' : 'bg-fill'}`}
                >
                  {CATEGORY_META[cat].label}
                </button>
              );
            })}
          </div>
        </Section>
        <Section header="Date range">
          <FieldRow label="From" htmlFor="f-from">
            <input
              id="f-from"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="field-input bg-transparent text-accent-text"
            />
          </FieldRow>
          <FieldRow label="To" htmlFor="f-to">
            <input
              id="f-to"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="field-input bg-transparent text-accent-text"
            />
          </FieldRow>
        </Section>
      </Sheet>
    </PullToRefresh>
  );
}
