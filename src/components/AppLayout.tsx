import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import ImpersonationBar from "./ImpersonationBar";
import AiAssistant from "./AiAssistant";

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ImpersonationBar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <AiAssistant />
    </div>
  );
}
