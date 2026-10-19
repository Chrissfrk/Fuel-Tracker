import { useMemo } from 'react';
import { averageKmPerDay, estimatedOdometer, reminderStatuses, todayIso } from '@fuel/shared';
import { Page } from '../../components/ui/Page';
import { Row, Section } from '../../components/ui/List';
import { isAdmin, useMe } from '../../app/context';
import {
  useCars,
  useExpenses,
  useFillups,
  useOdometerReadings,
  useReminders,
} from '../../data/hooks';
import { promptInstall, useInstallMode } from '../../lib/install';
import { hueVar } from '../../lib/palette';

function useAttentionCount() {
  const cars = useCars();
  const fillups = useFillups(null);
  const expenses = useExpenses(null);
  const readings = useOdometerReadings(null);
  const reminders = useReminders(null);
  return useMemo(() => {
    const today = todayIso();
    const ctx = new Map(
      cars.map((car) => {
        const f = fillups.filter((x) => x.carId === car.id);
        return [
          car.id,
          {
            car,
            odometerKm: estimatedOdometer(car, f, readings, expenses).km,
            today,
            kmPerDay: averageKmPerDay(f, today),
          },
        ] as const;
      }),
    );
    return reminderStatuses(reminders, ctx).filter((s) => s.status !== 'ok').length;
  }, [cars, fillups, expenses, readings, reminders]);
}

export function MorePage() {
  const me = useMe();
  const attention = useAttentionCount();
  const install = useInstallMode();
  return (
    <Page title="More" large>
      <Section>
        <Row to="/more/cars" title="Cars" icon={{ name: 'car', color: hueVar('blue') }} />
        <Row
          to="/more/reminders"
          title="Reminders"
          icon={{ name: 'bell', color: hueVar('orange') }}
          value={
            attention > 0 ? (
              <span
                className="rounded-full bg-red px-2 py-0.5 text-footnote font-semibold text-white"
                aria-label={`${attention} need attention`}
              >
                {attention}
              </span>
            ) : undefined
          }
        />
        <Row to="/more/budget" title="Budget" icon={{ name: 'wallet', color: hueVar('green') }} />
      </Section>
      <Section>
        <Row
          to="/more/data"
          title="Export & import"
          icon={{ name: 'share', color: hueVar('indigo') }}
        />
        <Row
          to="/more/paste"
          title="Import past fill-ups"
          icon={{ name: 'paste', color: hueVar('purple') }}
        />
      </Section>
      {isAdmin(me) && (
        <Section>
          <Row
            to="/more/users"
            title="Family members"
            icon={{ name: 'users', color: hueVar('pink') }}
          />
        </Section>
      )}
      <Section>
        <Row to="/more/settings" title="Settings" icon={{ name: 'gear', color: hueVar('gray') }} />
        {install === 'prompt' && (
          <Row
            title="Install app"
            icon={{ name: 'download', color: hueVar('cyan') }}
            onClick={() => void promptInstall()}
            chevron={false}
          />
        )}
      </Section>
      <p className="mt-6 text-center text-footnote text-label-2">
        Signed in as {me.displayName} · Fuel Tracker {__APP_VERSION__}
      </p>
    </Page>
  );
}
