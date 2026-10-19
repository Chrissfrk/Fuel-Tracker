import {
  formatCurrency,
  formatDate,
  formatKm,
  formatLiters,
  formatPricePerLiter,
  pricePerLiter,
  type Car,
  type HistoryItem,
} from '@fuel/shared';
import { IconTile } from '../../components/ui/List';
import { Icon } from '../../components/ui/Icon';
import { CATEGORY_META, FUEL_COLOR } from '../labels';
import { carColor } from '../../lib/theme';

/** One fill-up / expense / odometer reading, with key numbers and who logged it. */
export function RecordRowContent({
  item,
  car,
  carIndex,
  showCar,
  loggedBy,
}: {
  item: HistoryItem;
  car: Car | undefined;
  carIndex: number;
  showCar: boolean;
  loggedBy: string | undefined;
}) {
  let icon, title, amount, details: string[];
  if (item.kind === 'fillup') {
    const f = item.record;
    icon = <IconTile name="fuel" color={FUEL_COLOR} size={36} />;
    title = f.station ?? 'Fill-up';
    amount = formatCurrency(f.totalCost);
    details = [formatLiters(f.liters), formatPricePerLiter(pricePerLiter(f)), formatKm(f.tripKm)];
    if (!f.fullTank) details.push('Partial');
  } else if (item.kind === 'expense') {
    const e = item.record;
    const m = CATEGORY_META[e.category];
    icon = <IconTile name={m.icon} color={m.color} size={36} />;
    title = m.label;
    amount = formatCurrency(e.amount);
    details = [e.note ?? '', e.odometerKm != null ? formatKm(e.odometerKm) : ''].filter(Boolean);
  } else {
    const r = item.record;
    icon = <IconTile name="gauge" color="#8e8e93" size={36} />;
    title = 'Odometer reading';
    amount = formatKm(r.odometerKm);
    details = [];
  }
  const hasPhoto = item.kind !== 'odometer' && item.record.receiptPhotoId != null;
  const missed = item.kind === 'fillup' && item.record.missedPrevious;

  return (
    <div className="flex items-center gap-3 py-2.5 pr-4 pl-4">
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-body font-medium">{title}</span>
          <span className="shrink-0 text-body font-semibold tabular">{amount}</span>
        </div>
        {details.length > 0 && (
          <div className="truncate text-subhead text-label-2 tabular">{details.join(' · ')}</div>
        )}
        <div className="mt-0.5 flex items-center gap-1.5 truncate text-footnote text-label-2">
          <span className="tabular">{formatDate(item.record.date)}</span>
          {showCar && car && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: carColor(car, carIndex) }}
                  aria-hidden
                />
                {car.name}
              </span>
            </>
          )}
          {loggedBy && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">Logged by {loggedBy}</span>
            </>
          )}
          {hasPhoto && (
            <Icon name="photo" size={14} className="shrink-0" title="Has receipt photo" />
          )}
          {missed && <span className="shrink-0 text-orange-text">· Missed previous</span>}
        </div>
      </div>
    </div>
  );
}
