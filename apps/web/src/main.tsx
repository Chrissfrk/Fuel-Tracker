import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { AuthGate } from './app/AuthGate';
import { router } from './app/router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, networkMode: 'always' } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <RouterProvider router={router} />
      </AuthGate>
    </QueryClientProvider>
  </StrictMode>,
);
