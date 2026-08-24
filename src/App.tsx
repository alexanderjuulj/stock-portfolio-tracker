import "@/styles/main.scss";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components";
import { DashboardPage, HistoryPage, SettingsPage } from "@/features";

function App() {
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
