import "@/styles/main.scss";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppHeader } from "@/components";
import { DashboardPage, HistoryPage, SettingsPage } from "@/features";
import { useConcept } from "@/lib/concept";
import { usePrivacy } from "@/lib/privacy";

function App() {
  // Subscribing here re-renders the whole tree when "hide figures" flips,
  // since the formatters in lib/utils read the mode at call time.
  usePrivacy();
  // Flipping concept mode swaps the database behind the API, so the key
  // remounts the page tree: every page refetches and open dialogs close.
  const { active: conceptActive } = useConcept();

  return (
    <BrowserRouter>
      <AppHeader />
      <Routes key={conceptActive ? "concept" : "real"}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
