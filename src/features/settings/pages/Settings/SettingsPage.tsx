import { useRef, useState, type FC, type FormEvent } from "react";
import type { JSX } from "react/jsx-runtime";
import { ConfirmDialog } from "@/components";
import { cn } from "@/lib/utils";
import { THEMES } from "@/lib/theme";
import type { AppSettings, QuoteProvider } from "@/types/api";
import { importBackup } from "../../api";
import { useSettings, useTheme } from "../../hooks";
import styles from "./SettingsPage.module.scss";

type MarketDataFormProps = {
  /** Settings as loaded from the server; seeds the form state at mount. */
  initial: AppSettings;
  saving: boolean;
  onSave: (next: AppSettings) => Promise<void>;
};

// Rendered only once settings have loaded, so useState can seed from props.
const MarketDataForm: FC<MarketDataFormProps> = ({ initial, saving, onSave }): JSX.Element => {
  const [provider, setProvider] = useState<QuoteProvider>(initial.provider);
  const [finnhubApiKey, setFinnhubApiKey] = useState(initial.finnhubApiKey);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const pickProvider = (next: QuoteProvider) => {
    setProvider(next);
    setSaved(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSaved(false);
    setSaveError(null);
    onSave({ provider, finnhubApiKey: finnhubApiKey.trim() })
      .then(() => setSaved(true))
      .catch((err: Error) => setSaveError(err.message));
  };

  return (
    <form className={styles.section} onSubmit={handleSubmit}>
      <h2 className={styles.sectionTitle}>Market data</h2>
      <p className={styles.sectionText}>
        Prices are fetched on the server and cached for 15 minutes. Pick where they come from.
      </p>

      <label className={cn(styles.providerCard, provider === "yahoo" && styles.providerActive)}>
        <input
          className={styles.radio}
          type="radio"
          name="provider"
          checked={provider === "yahoo"}
          onChange={() => pickProvider("yahoo")}
        />
        <span>
          <span className={styles.providerName}>Yahoo Finance</span>
          <span className={styles.providerNote}>
            No API key needed. Covers most exchanges worldwide, including Nasdaq Copenhagen.
            Unofficial API — can break without notice.
          </span>
        </span>
      </label>

      <label className={cn(styles.providerCard, provider === "finnhub" && styles.providerActive)}>
        <input
          className={styles.radio}
          type="radio"
          name="provider"
          checked={provider === "finnhub"}
          onChange={() => pickProvider("finnhub")}
        />
        <span>
          <span className={styles.providerName}>Finnhub</span>
          <span className={styles.providerNote}>
            Official API, free key from finnhub.io. US-listed stocks only on the free plan; 60
            requests per minute.
          </span>
        </span>
      </label>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="finnhub-key">
          Finnhub API key
        </label>
        <input
          id="finnhub-key"
          className={styles.input}
          type="text"
          value={finnhubApiKey}
          onChange={(e) => {
            setFinnhubApiKey(e.target.value);
            setSaved(false);
          }}
          placeholder="Only needed when Finnhub is selected"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {saveError ? <p className={styles.error}>{saveError}</p> : null}

      <div className={styles.actions}>
        <button type="submit" className={styles.primaryButton} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved ? <span className={styles.savedNote}>Saved</span> : null}
      </div>
    </form>
  );
};

// Radio cards for the appearance choice; applies immediately, no save step.
const AppearanceSection: FC = (): JSX.Element => {
  const { theme, setTheme } = useTheme();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Appearance</h2>
      <p className={styles.sectionText}>
        Stored in this browser only. Changes apply right away.
      </p>
      <div className={styles.themeGrid}>
        {THEMES.map((t) => (
          <label
            key={t.value}
            className={cn(styles.providerCard, theme === t.value && styles.providerActive)}
          >
            <input
              className={styles.radio}
              type="radio"
              name="theme"
              checked={theme === t.value}
              onChange={() => setTheme(t.value)}
            />
            <span>
              <span className={styles.providerName}>{t.label}</span>
              <span className={styles.providerNote}>{t.note}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
};

const SettingsPage: FC = (): JSX.Element => {
  const { settings, loading, error, saving, save } = useSettings();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const confirmImport = () => {
    if (!importFile) return;
    setImportBusy(true);
    setImportError(null);
    importBackup(importFile)
      .then(() => window.location.assign("/")) // restart the app on the imported data
      .catch((err: Error) => {
        setImportError(err.message);
        setImportBusy(false);
        setImportFile(null);
      });
  };

  return (
    <main className={styles.page}>
      <span className={styles.kicker}>Rahamasin</span>
      <h1 className={styles.heading}>Settings</h1>

      <AppearanceSection />

      {loading ? (
        <p className={styles.muted}>Loading settings…</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : settings ? (
        <>
          <MarketDataForm initial={settings} saving={saving} onSave={save} />

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Exchange rates</h2>
            <p className={styles.sectionText}>
              Values are converted to EUR with the European Central Bank reference rates (via
              Frankfurter). Updated daily, no key needed.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Backup</h2>
            <p className={styles.sectionText}>
              The whole portfolio lives in one local SQLite file. Export it for safekeeping, or
              import a previous export — importing replaces everything.
            </p>
            <div className={styles.actions}>
              <a className={styles.ghostButton} href="/api/export" download>
                Export backup
              </a>
              <button
                type="button"
                className={styles.ghostButton}
                onClick={() => fileInputRef.current?.click()}
                disabled={importBusy}
              >
                Import backup…
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".db"
                hidden
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
            </div>
            {importError ? <p className={styles.error}>{importError}</p> : null}
          </section>
        </>
      ) : null}

      <ConfirmDialog
        open={importFile !== null}
        title="Replace the database?"
        message={
          importFile
            ? `Everything currently in the app will be replaced with the contents of "${importFile.name}". Export a backup first if you want to keep the current data.`
            : ""
        }
        confirmLabel="Import and replace"
        danger
        busy={importBusy}
        onConfirm={confirmImport}
        onCancel={() => setImportFile(null)}
      />
    </main>
  );
};

export default SettingsPage;
