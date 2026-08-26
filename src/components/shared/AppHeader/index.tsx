import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import PrivacyToggle from "../PrivacyToggle";
import ThemeToggle from "../ThemeToggle";
import styles from "./AppHeader.module.scss";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(styles.link, isActive && styles.linkActive);

const AppHeader: FC = (): JSX.Element => (
  <header className={styles.header}>
    <div className={styles.inner}>
      <NavLink to="/" className={styles.brand}>
        <span className={styles.brandAccent}>RAHA</span>MASIN
      </NavLink>
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
          <PrivacyToggle />
          <ThemeToggle />
        </div>
      </nav>
    </div>
  </header>
);

export default AppHeader;
