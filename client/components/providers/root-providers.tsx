import { Toaster } from "../ui/sonner";
import { TooltipProvider } from "../ui/tooltip";

export function RootProviders({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <Toaster theme="light" />
    </TooltipProvider>
  )
}