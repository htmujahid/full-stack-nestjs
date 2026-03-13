import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { AppRoutes } from '@/routes';
import { RootProviders } from '@/components/providers/root-providers';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <RootProviders>
        <AppRoutes />
      </RootProviders>
    </BrowserRouter>
  </StrictMode>,
);
