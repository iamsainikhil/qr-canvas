import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { logEvent } from "firebase/analytics";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import ScanError from "./pages/ScanError";
import TrackingRedirect from "./pages/TrackingRedirect";
import { PrivateAppGate } from "./components/PrivateAppGate";
import { analytics } from "./integrations/firebase/client";

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    if (!analytics) return;
    logEvent(analytics, 'page_view', { page_path: location.pathname });
  }, [location.pathname]);
  return null;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PrivateAppGate>
          <PageViewTracker />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/r/:shortCode" element={<TrackingRedirect />} />
            <Route path="/scan-error" element={<ScanError />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </PrivateAppGate>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
