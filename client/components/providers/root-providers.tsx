import { Toaster } from '../ui/sonner';
import { TooltipProvider } from '../ui/tooltip';
import { QueryProvider } from './query-provider';

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider>
        {children}
        <Toaster theme="light" />
      </TooltipProvider>
    </QueryProvider>
  );
}