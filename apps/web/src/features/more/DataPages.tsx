import { useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  formatCurrency,
  formatDate,
  formatKm,
  formatLiters,
  formatPricePerLiter,
  parsePasteImport,
  pricePerLiter,
  type Fillup,
} from '@fuel/shared';
import { Page } from '../../components/ui/Page';
import { FieldRow, Row, Section } from '../../components/ui/List';
import { Button, Switch } from '../../components/ui/Controls';
import { CarDot } from '../../components/ui/CarSwitcher';
import { Icon } from '../../components/ui/Icon';
import { toast } from '../../components/ui/Toast';
import { isAdmin, useCarIdState, useMe } from '../../app/context';
import { useCars } from '../../data/hooks';
import { api, errorMessage } from '../../data/api';
import { newBase, saveRecord } from '../../data/mutations';
import { syncNow } from '../../data/sync';
import { carColor } from '../../lib/theme';

async function download(url: string, fallbackName: string) {
  const blob = await api<Blob>(url, { timeoutMs: 60_000 });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function DataPage() {
  const me = useMe();
  const cars = useCars({ includeArchived: true });
  const [scope, setScope] = useState<string>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const uid = useId();
  const q = scope === 'all' ? '' : `?carId=${scope}`;
  const stamp = new Date().toISOString().slice(0, 10);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const importJson = async (f: File) => {
    const text = await f.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error('That file is not a JSON backup');
    }
    const res = await api<{
      counts: Record<string, { imported: number; skipped: number; invalid: number }>;
      errors: string[];
    }>('/api/import/json', {
      method: 'POST',
      json: body,
      timeoutMs: 120_000,
    });
    const imported = Object.values(res.counts).reduce((s, c) => s + c.imported, 0);
    const skipped = Object.values(res.counts).reduce((s, c) => s + c.skipped, 0);
    const invalid = Object.values(res.counts).reduce((s, c) => s + c.invalid, 0);
    await syncNow({ full: true });
    toast({
      tone: invalid ? 'error' : 'success',
      message: `Restored ${imported} records${skipped ? `, ${skipped} already up to date` : ''}${invalid ? `, ${invalid} invalid` : ''}.`,
      duration: 7000,
    });
  };

  return (
    <Page title="Export & import" back={{ label: 'More', to: '/more' }}>
      <Section
        header="Export"
        footer="CSV is one file per record type in a zip, for spreadsheets. JSON is a full backup you can restore."
      >
        <FieldRow label="Data" htmlFor={`${uid}s`}>
          <select
            id={`${uid}s`}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="field-input appearance-none bg-transparent text-label-2"
            style={{ textAlignLast: 'right' }}
          >
            <option value="all">All cars</option>
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <Row
          title="Download CSV (zip)"
          icon={{ name: 'download', color: '#30a14e' }}
          chevron={false}
          trailing={
            busy === 'csv' ? <span className="text-footnote text-label-2">Preparing…</span> : null
          }
          onClick={() =>
            void run('csv', () => download(`/api/export/csv${q}`, `fuel-export-${stamp}.zip`))
          }
        />
        <Row
          title="Download JSON backup"
          icon={{ name: 'download', color: '#0a84ff' }}
          chevron={false}
          trailing={
            busy === 'json' ? <span className="text-footnote text-label-2">Preparing…</span> : null
          }
          onClick={() =>
            void run('json', () => download(`/api/export/json${q}`, `fuel-backup-${stamp}.json`))
          }
        />
      </Section>

      <Section header="Import">
        <Row
          title="Paste past fill-ups"
          subtitle="From a spreadsheet or notes"
          icon={{ name: 'paste', color: '#8e5bd8' }}
          onClick={() => navigate('/more/paste')}
        />
        {isAdmin(me) && (
          <Row
            title="Restore JSON backup"
            subtitle="Merges with what's here; newer changes win"
            icon={{ name: 'upload', color: '#ff9f0a' }}
            chevron={false}
            trailing={
              busy === 'import' ? (
                <span className="text-footnote text-label-2">Restoring…</span>
              ) : null
            }
            onClick={() => file.current?.click()}
          />
        )}
      </Section>
      <input
        ref={file}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void run('import', () => importJson(f));
        }}
      />
      <p className="mt-6 px-4 text-footnote text-label-2">
        Exports need a connection. The server also keeps a backup every night for 14 days.
      </p>
    </Page>
  );
}

export function PasteImportPage() {
  const me = useMe();
  const cars = useCars();
  const navigate = useNavigate();
  const [carId, setCarId] = useCarIdState(null);
  const [text, setText] = useState('');
  const [fullTank, setFullTank] = useState(true);
  const [busy, setBusy] = useState(false);
  const uid = useId();
  const rows = useMemo(() => parsePasteImport(text), [text]);
  const good = rows.filter((r) => r.value);
  const bad = rows.filter((r) => !r.value);
  const car = cars.find((c) => c.id === carId);

  const confirm = async () => {
    setBusy(true);
    try {
      let t = Date.now() - good.length;
      for (const r of good) {
        const base = newBase(me.id);
        const rec: Fillup = {
          ...base,
          createdAt: t,
          updatedAt: t,
          carId,
          date: r.value!.date,
          tripKm: r.value!.tripKm,
          liters: r.value!.liters,
          totalCost: r.value!.totalCost,
          fullTank,
          missedPrevious: false,
          fuelType: null,
          station: r.value!.station,
          note: null,
          receiptPhotoId: null,
        };
        t++;
        await saveRecord('fillups', rec);
      }
      toast({
        tone: 'success',
        message: `Imported ${good.length} fill-ups into ${car?.name ?? 'the car'}`,
      });
      navigate('/history');
    } catch (err) {
      toast({ tone: 'error', message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Import fill-ups" back={{ label: 'Back' }}>
      <Section>
        <FieldRow label="Car" htmlFor={`${uid}c`}>
          {car && <CarDot color={carColor(car, cars.indexOf(car))} />}
          <select
            id={`${uid}c`}
            value={carId}
            onChange={(e) => setCarId(e.target.value)}
            className="field-input appearance-none bg-transparent text-label-2"
            style={{ textAlignLast: 'right' }}
          >
            {cars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="All are full tanks">
          <Switch checked={fullTank} onChange={setFullTank} label="All are full tanks" />
        </FieldRow>
      </Section>
      <Section
        header="Paste one fill-up per line"
        footer={
          <>
            Date, trip km, liters, cost and an optional station. Tabs, semicolons or commas between
            values; <code>41,2</code> or <code>41.2</code> both work.
            <br />
            Example: <code>2026-09-03, 612, 41.2, 72.50</code>
          </>
        }
      >
        <label htmlFor={`${uid}t`} className="sr-only">
          Fill-ups to import
        </label>
        <textarea
          id={`${uid}t`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          placeholder={'2026-09-03, 612, 41.2, 72.50\n18/09/2026\t580\t39,8\t70,10\tShell'}
          className="block w-full resize-y bg-transparent px-4 py-3 font-mono text-subhead outline-none placeholder:text-label-3"
        />
      </Section>

      {rows.length > 0 && (
        <section className="mt-6" aria-label="Preview">
          <h2 className="mb-1.5 flex justify-between px-4 text-footnote tracking-wide text-label-2 uppercase">
            <span>Preview</span>
            <span>
              {good.length} ready{bad.length ? ` · ${bad.length} with errors` : ''}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl bg-surface">
            <table className="w-full min-w-[560px] text-subhead tabular">
              <thead className="text-left text-footnote text-label-2">
                <tr>
                  <th className="px-3 py-2 font-medium">Line</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 text-right font-medium">Trip</th>
                  <th className="px-3 py-2 text-right font-medium">Liters</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium">€/L</th>
                  <th className="px-3 py-2 font-medium">Station</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) =>
                  r.value ? (
                    <tr key={r.line} className="border-t-[0.5px] border-separator">
                      <td className="px-3 py-2 text-label-2">{r.line}</td>
                      <td className="px-3 py-2">{formatDate(r.value.date)}</td>
                      <td className="px-3 py-2 text-right">{formatKm(r.value.tripKm)}</td>
                      <td className="px-3 py-2 text-right">{formatLiters(r.value.liters)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.value.totalCost)}</td>
                      <td className="px-3 py-2 text-right text-label-2">
                        {formatPricePerLiter(pricePerLiter(r.value))}
                      </td>
                      <td className="px-3 py-2 text-label-2">{r.value.station ?? ''}</td>
                    </tr>
                  ) : (
                    <tr
                      key={r.line}
                      className="border-t-[0.5px] border-separator bg-[color-mix(in_srgb,var(--red)_8%,transparent)]"
                    >
                      <td className="px-3 py-2 text-label-2">{r.line}</td>
                      <td colSpan={6} className="px-3 py-2">
                        <span className="flex items-start gap-1.5 text-red-text">
                          <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
                          <span>
                            {r.errors.join('. ')}
                            <span className="block font-mono text-footnote text-label-2">
                              {r.raw}
                            </span>
                          </span>
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Button
        className="mt-6 w-full"
        disabled={good.length === 0 || !carId}
        loading={busy}
        onClick={() => void confirm()}
      >
        {good.length > 0
          ? `Import ${good.length} fill-up${good.length === 1 ? '' : 's'}`
          : 'Import'}
      </Button>
      {bad.length > 0 && good.length > 0 && (
        <p className="mt-2 text-center text-footnote text-label-2">
          Lines with errors will be skipped.
        </p>
      )}
    </Page>
  );
}
