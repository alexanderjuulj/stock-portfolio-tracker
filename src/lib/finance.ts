// Fixed option lists for the forms — picking from a list instead of typing
// keeps sectors and currencies consistent across stocks and accounts.

/** ISO codes Frankfurter (ECB) can convert to EUR, most common first. */
export const CURRENCIES = [
  "EUR",
  "USD",
  "DKK",
  "GBP",
  "SEK",
  "NOK",
  "CHF",
  "JPY",
  "CAD",
  "AUD",
  "NZD",
  "HKD",
  "SGD",
  "CNY",
  "INR",
  "KRW",
  "PLN",
  "CZK",
  "HUF",
  "RON",
  "BGN",
  "ISK",
  "TRY",
  "ZAR",
  "BRL",
  "MXN",
  "ILS",
  "IDR",
  "MYR",
  "PHP",
  "THB",
] as const;

/** The 11 GICS sectors. */
export const SECTORS = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
] as const;
