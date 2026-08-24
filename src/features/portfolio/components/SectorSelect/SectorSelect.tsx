import { useState, type FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { fieldClasses } from "@/components";
import { SECTORS } from "@/lib/finance";

const OTHER = "__other__";

type SectorSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** Sectors already used by existing stocks, offered alongside the GICS list. */
  knownSectors: string[];
};

/**
 * GICS sectors + sectors already in use, so the same sector is always spelled
 * the same way. "Other…" reveals a text input for a genuinely new one.
 */
const SectorSelect: FC<SectorSelectProps> = ({ id, value, onChange, knownSectors }): JSX.Element => {
  const options = [...new Set<string>([...SECTORS, ...knownSectors])].filter((s) => s !== "");
  const [customMode, setCustomMode] = useState(() => value !== "" && !options.includes(value));
  const showCustom = customMode || (value !== "" && !options.includes(value));

  return (
    <>
      <select
        id={id}
        className={fieldClasses.select}
        value={showCustom ? OTHER : value}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">No sector</option>
        {options.map((sector) => (
          <option key={sector} value={sector}>
            {sector}
          </option>
        ))}
        <option value={OTHER}>Other…</option>
      </select>
      {showCustom ? (
        <input
          className={fieldClasses.input}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Sector name"
          aria-label="Custom sector"
          autoFocus
        />
      ) : null}
    </>
  );
};

export default SectorSelect;
