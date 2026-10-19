import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './AppShell';
import { HomePage } from '../features/home/HomePage';
import { HistoryPage } from '../features/history/HistoryPage';
import { MorePage } from '../features/more/MorePage';
import { CarEditPage, CarsPage } from '../features/more/CarsPages';
import { ReminderEditPage, RemindersPage } from '../features/more/RemindersPages';
import { BudgetPage } from '../features/more/BudgetPage';
import { DataPage, PasteImportPage } from '../features/more/DataPages';
import { UsersPage } from '../features/more/UsersPage';
import { SettingsPage } from '../features/more/SettingsPage';

// Chart.js is only needed on the Stats tab.
const StatsPage = lazy(() => import('../features/stats/StatsPage'));

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'history', element: <HistoryPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'more', element: <MorePage /> },
      { path: 'more/cars', element: <CarsPage /> },
      { path: 'more/cars/:id', element: <CarEditPage /> },
      { path: 'more/reminders', element: <RemindersPage /> },
      { path: 'more/reminders/:id', element: <ReminderEditPage /> },
      { path: 'more/budget', element: <BudgetPage /> },
      { path: 'more/data', element: <DataPage /> },
      { path: 'more/paste', element: <PasteImportPage /> },
      { path: 'more/users', element: <UsersPage /> },
      { path: 'more/settings', element: <SettingsPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
