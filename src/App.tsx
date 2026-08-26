import "@/styles/main.scss";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components";
import { DashboardPage, HistoryPage, SettingsPage } from "@/features";
import { usePrivacy } from "@/lib/privacy";

function App() {
  // Subscribing here re-renders the whole tree when "hide figures" flips,
  // since the formatters in lib/utils read the mode at call time.
  usePrivacy();

  return (
    <BrowserRouter>
      <AppHeader />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
