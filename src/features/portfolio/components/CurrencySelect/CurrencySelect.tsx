import type { FC } from "react";
import type { JSX } from "react/jsx-runtime";
import { fieldClasses } from "@/components";
import { CURRENCIES } from "@/lib/finance";

type CurrencySelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
};

/** ISO currency picker; a stored value outside the list is still offered. */
const CurrencySelect: FC<CurrencySelectProps> = ({ id, value, onChange }): JSX.Element => {
  const known = (CURRENCIES as readonly string[]).includes(value);
  const options = known ? CURRENCIES : [value, ...CURRENCIES];
  return (
    <select
      id={id}
      className={fieldClasses.select}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
};

export default CurrencySelect;
