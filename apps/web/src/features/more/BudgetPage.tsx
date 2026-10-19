import { useEffect, useId, useMemo, useState } from 'react';
import {
  budgetProgress,
  formatCurrency,
  monthKey,
  monthOf,
  monthlyStats,
  parseDecimal,
  toInputNumber,
  todayIso,
  type Budget,
} from '@fuel/shared';
import { Page } from '../../components/ui/Page';
import { FieldRow, Section } from '../../components/ui/List';
import { Button, NumberInput } from '../../components/ui/Controls';
import { BUDGET_LABEL, Ring } from '../../components/ui/Stats';
import { CarDot } from '../../components/ui/CarSwitcher';
import { toast } from '../../components/ui/Toast';
import { isAdmin, useMe } from '../../app/context';
import { useBudgets, useCars, useExpenses, useFillups } from '../../data/hooks';
import { newBase, saveRecord, softDelete } from '../../data/mutations';
import { carColor } from '../../lib/theme';

export function BudgetPage() {
  const me = useMe();
  const admin = isAdmin(me);
  const cars = useCars();
  const budgets = useBudgets();
  const fillups = useFillups(null);
  const expenses = useExpenses(null);
  const uid = useId();
  const month = monthKey(todayIso());

  const spent = useMemo(() => {
    const per = new Map<string | null, number>();
    per.set(null, monthOf(monthlyStats({ fillups, expenses }, { to: month }), month).totalCost);
    for (const c of cars) {
      per.set(
        c.id,
        monthOf(
          monthlyStats(
            {
              fillups: fillups.filter((f) => f.carId === c.id),
              expenses: expenses.filter((e) => e.carId === c.id),
            },
            { to: month },
          ),
          month,
        ).totalCost,
      );
    }
    return per;
  }, [cars, fillups, expenses, month]);

  const targets: { carId: string | null; label: string; color: string | null }[] = [
    { carId: null, label: 'Household', color: null },
    ...cars.map((c, i) => ({ carId: c.id, label: c.name, color: carColor(c, i) })),
  ];
  const find = (carId: string | null) => budgets.find((b) => b.carId === carId);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  // Fill the inputs once the local data has loaded (until the user starts typing).
  useEffect(() => {
    if (touched) return;
    setValues(
      Object.fromEntries(
        [null, ...cars.map((c) => c.id)].map((id) => {
          const b = budgets.find((x) => x.carId === id);
          return [id ?? 'household', b ? toInputNumber(b.monthlyAmount, 0) : ''];
        }),
      ),
    );
  }, [budgets, cars, touched]);

  const save = async () => {
    setSaving(true);
    try {
      for (const t of targets) {
        const key = t.carId ?? 'household';
        const amount = parseDecimal(values[key] ?? '');
        const existing = find(t.carId);
        if (amount == null || amount <= 0) {
          if (existing) await softDelete('budgets', existing.id);
        } else if (!existing || existing.monthlyAmount !== amount) {
          const b: Budget = {
            ...(existing ?? newBase(me.id)),
            carId: t.carId,
            monthlyAmount: amount,
          };
          await saveRecord('budgets', b);
        }
      }
      toast({ tone: 'success', message: 'Budgets saved' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page title="Budget" back={{ label: 'More', to: '/more' }}>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {targets.map((t) => {
          const b = find(t.carId);
          const s = spent.get(t.carId) ?? 0;
          const p = b ? budgetProgress(s, b.monthlyAmount) : null;
          return (
            <div
              key={t.carId ?? 'h'}
              className="flex flex-col items-center rounded-2xl bg-surface p-4 text-center"
            >
              <Ring ratio={p?.ratio ?? 0} status={p?.status ?? 'ok'} size={84} stroke={10}>
                <span className="text-subhead font-semibold tabular">
                  {p ? `${Math.round(p.ratio * 100)}%` : '–'}
                </span>
              </Ring>
              <p className="mt-2 inline-flex items-center gap-1.5 text-headline">
                {t.color && <CarDot color={t.color} size={8} />}
                {t.label}
              </p>
              <p className="text-footnote text-label-2 tabular">
                {formatCurrency(s, { whole: true })}
                {b ? ` of ${formatCurrency(b.monthlyAmount, { whole: true })}` : ' · no budget'}
              </p>
              {p && (
                <p
                  className={`text-footnote font-semibold ${p.status === 'ok' ? 'text-green-text' : p.status === 'warning' ? 'text-orange-text' : 'text-red-text'}`}
                >
                  {BUDGET_LABEL[p.status]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Section
        header="Monthly budget"
        footer={
          admin
            ? 'Fuel plus all other car expenses. Leave empty for no budget.'
            : 'Only an admin can change budgets.'
        }
      >
        {targets.map((t) => {
          const key = t.carId ?? 'household';
          return (
            <FieldRow
              key={key}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {t.color && <CarDot color={t.color} size={8} />}
                  {t.label}
                </span>
              }
              htmlFor={`${uid}${key}`}
            >
              {admin ? (
                <NumberInput
                  id={`${uid}${key}`}
                  value={values[key] ?? ''}
                  onChange={(v) => (setTouched(true), setValues({ ...values, [key]: v }))}
                  suffix="€"
                  placeholder="–"
                  inputMode="decimal"
                />
              ) : (
                <span className="text-label-2 tabular">
                  {find(t.carId)
                    ? formatCurrency(find(t.carId)!.monthlyAmount, { whole: true })
                    : '–'}
                </span>
              )}
            </FieldRow>
          );
        })}
      </Section>
      {admin && (
        <Button className="mt-6 w-full" onClick={() => void save()} loading={saving}>
          Save budgets
        </Button>
      )}
    </Page>
  );
}
