import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { FirmProvider } from "@/contexts/FirmContext";
import { DraftPanelProvider } from "@/contexts/DraftPanelContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import ContactProfile from "./pages/ContactProfile";
import AccountDetail from "./pages/AccountDetail";
import Contacts from "./pages/Contacts";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Scorecard from "./pages/Scorecard";
import GoodieChat from "./pages/GoodieChat";
import Households from "./pages/Households";
import HouseholdProfile from "./pages/HouseholdProfile";
import AdminAdvisors from "./pages/AdminAdvisors";
import AdminFirms from "./pages/AdminFirms";
import FirmDetail from "./pages/FirmDetail";
import AdminStaff from "./pages/AdminStaff";
import StaffDetail from "./pages/StaffDetail";
import AdvisorDetail from "./pages/AdvisorDetail";
import Performance from "./pages/Performance";
import CalendarPage from "./pages/Calendar";
import MyRequests from "./pages/MyRequests";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import AdminRequests from "./pages/AdminRequests";
import AdminRetention from "./pages/AdminRetention";
import AdminDeveloper from "./pages/AdminDeveloper";
import AdminVpmRequests from "./pages/AdminVpmRequests";
import VpmTicketDetail from "./pages/VpmTicketDetail";
import VpmWorkspace from "./pages/VpmWorkspace";
import RequestDetail from "./pages/RequestDetail";
import ComingSoon from "./pages/ComingSoon";
import Reports from "./pages/Reports";
import Pipeline from "./pages/Pipeline";
import ProspectDetail from "./pages/ProspectDetail";
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
        <Analytics />
        <BrowserRouter>
        <ImpersonationProvider>
        <FirmProvider>
        <DraftPanelProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/scorecard" element={<Scorecard />} />
              <Route path="/goodie" element={<GoodieChat />} />
              <Route path="/households" element={<Households />} />
              <Route path="/household/:id" element={<HouseholdProfile />} />
              <Route path="/contacts" element={<Contacts />} />
              <Route path="/contacts/:id" element={<ContactProfile />} />
              <Route path="/accounts/:id" element={<AccountDetail />} />
              <Route path="/performance" element={<Performance />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/prospects/:id" element={<ProspectDetail />} />
              <Route path="/my-requests" element={<MyRequests />} />
              <Route path="/my-requests/:id" element={<RequestDetail />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/tasks/:id" element={<TaskDetail />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/advisors" element={<AdminRoute><AdminAdvisors /></AdminRoute>} />
              <Route path="/admin/firms" element={<AdminRoute><AdminFirms /></AdminRoute>} />
              <Route path="/admin/firms/:id" element={<AdminRoute><FirmDetail /></AdminRoute>} />
              <Route path="/admin/staff" element={<AdminRoute><AdminStaff /></AdminRoute>} />
              <Route path="/admin/staff/:id" element={<AdminRoute><StaffDetail /></AdminRoute>} />
              <Route path="/admin/advisors/:id" element={<AdminRoute><AdvisorDetail /></AdminRoute>} />
              <Route path="/admin/requests" element={<AdminRoute><AdminRequests /></AdminRoute>} />
              <Route path="/admin/requests/:id" element={<AdminRoute><RequestDetail /></AdminRoute>} />
              <Route path="/admin/retention" element={<AdminRoute><AdminRetention /></AdminRoute>} />
              <Route path="/admin/developer" element={<AdminRoute><AdminDeveloper /></AdminRoute>} />
              <Route path="/admin/vpm-requests" element={<AdminRoute><AdminVpmRequests /></AdminRoute>} />
              <Route path="/admin/vpm-requests/:id" element={<AdminRoute><VpmTicketDetail /></AdminRoute>} />
              <Route path="/vpm/workspace" element={<AdminRoute><VpmWorkspace /></AdminRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </DraftPanelProvider>
        </FirmProvider>
        </ImpersonationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
