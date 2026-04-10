import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import ContactProfile from "./pages/ContactProfile";
import Contacts from "./pages/Contacts";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Households from "./pages/Households";
import HouseholdProfile from "./pages/HouseholdProfile";
import AdminAdvisors from "./pages/AdminAdvisors";
import AdvisorDetail from "./pages/AdvisorDetail";
import Performance from "./pages/Performance";
import ComingSoon from "./pages/ComingSoon";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
        <ImpersonationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/households" element={<Households />} />
              <Route path="/household/:id" element={<HouseholdProfile />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/contacts/:id" element={<ContactProfile />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/admin/advisors" element={<AdminRoute><AdminAdvisors /></AdminRoute>} />
              <Route path="/admin/advisors/:id" element={<AdminRoute><AdvisorDetail /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ImpersonationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
