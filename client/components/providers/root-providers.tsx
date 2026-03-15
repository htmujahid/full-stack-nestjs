import { Toaster } from '../ui/sonner';
import { TooltipProvider } from '../ui/tooltip';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AuthProvider>
        <TooltipProvider>
          {children}
          <Toaster theme="light" />
        </TooltipProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
