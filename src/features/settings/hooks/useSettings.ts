import { useCallback, useEffect, useState } from "react";
import type { AppSettings } from "@/types/api";
import * as settingsApi from "../api";

/** Loads app settings on mount; `save` rethrows so forms can show the error. */
export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi
      .getSettings()
      .then((loaded) => {
        setSettings(loaded);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const save = useCallback(async (next: AppSettings) => {
    setSaving(true);
    try {
      setSettings(await settingsApi.saveSettings(next));
    } finally {
      setSaving(false);
    }
  }, []);

  return { settings, loading, error, saving, save };
}
