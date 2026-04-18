import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { FirmProvider } from "@/contexts/FirmContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import ContactProfile from "./pages/ContactProfile";
import AccountDetail from "./pages/AccountDetail";
import Contacts from "./pages/Contacts";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Households from "./pages/Households";
import HouseholdProfile from "./pages/HouseholdProfile";
import AdminAdvisors from "./pages/AdminAdvisors";
import AdminFirms from "./pages/AdminFirms";
import AdminStaff from "./pages/AdminStaff";
import StaffDetail from "./pages/StaffDetail";
import AdvisorDetail from "./pages/AdvisorDetail";
import Performance from "./pages/Performance";
import CalendarPage from "./pages/Calendar";
import MyRequests from "./pages/MyRequests";
import Tasks from "./pages/Tasks";
import AdminRequests from "./pages/AdminRequests";
import RequestDetail from "./pages/RequestDetail";
import ComingSoon from "./pages/ComingSoon";
import Settings from "./pages/Settings";
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
        <FirmProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/households" element={<Households />} />
              <Route path="/household/:id" element={<HouseholdProfile />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/contacts/:id" element={<ContactProfile />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/reports" element={<ComingSoon />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/my-requests/:id" element={<RequestDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/advisors" element={<AdminRoute><AdminAdvisors /></AdminRoute>} />
              <Route path="/admin/firms" element={<AdminRoute><AdminFirms /></AdminRoute>} />
              <Route path="/admin/staff" element={<AdminRoute><AdminStaff /></AdminRoute>} />
              <Route path="/admin/staff/:id" element={<AdminRoute><StaffDetail /></AdminRoute>} />
              <Route path="/admin/advisors/:id" element={<AdminRoute><AdvisorDetail /></AdminRoute>} />
              <Route path="/admin/requests" element={<AdminRoute><AdminRequests /></AdminRoute>} />
              <Route path="/admin/requests/:id" element={<AdminRoute><RequestDetail /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </FirmProvider>
        </ImpersonationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
