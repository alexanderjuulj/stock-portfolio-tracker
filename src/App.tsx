import "@/styles/main.scss";
import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Flex, Heading, Text } from "@/components";
import { apiGet } from "@/lib/api";
import type { HealthResponse } from "@/types/api";

// Placeholder until the first feature lands — replace with a feature page
// (src/features/<feature>/pages/...) once the portfolio tracker takes shape.
function Home() {
  const [status, setStatus] = useState("Database: connecting…");

  useEffect(() => {
    apiGet<HealthResponse>("/health")
      .then((h) =>
        setStatus(`Database: SQLite ${h.sqliteVersion} · schema v${h.schemaVersion}`),
      )
      .catch((err: Error) => setStatus(`Database: unavailable (${err.message})`));
  }, []);

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="3"
      style={{ minHeight: "100vh" }}
    >
      <Heading as="h1">Rahamasin</Heading>
      <Text>Local stock portfolio tracker — nothing here yet.</Text>
      <Text size="2">{status}</Text>
    </Flex>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
