import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
import { useConcept } from "@/lib/concept";
import { cn } from "@/lib/utils";
import ConceptToggle from "../ConceptToggle";
import PrivacyToggle from "../PrivacyToggle";
import ThemeToggle from "../ThemeToggle";
import styles from "./AppHeader.module.scss";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(styles.link, isActive && styles.linkActive);

const AppHeader: FC = (): JSX.Element => {
  const { active: conceptActive } = useConcept();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brandGroup}>
          <NavLink to="/" className={styles.brand}>
            <span className={styles.brandAccent}>RAHA</span>MASIN
          </NavLink>
          {conceptActive ? <span className={styles.conceptBadge}>Concept</span> : null}
        </div>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={navLinkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/history" className={navLinkClass}>
            History
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            Settings
          </NavLink>
          <div className={styles.tools}>
            <ConceptToggle />
            <PrivacyToggle />
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
  );
};

export default AppHeader;
