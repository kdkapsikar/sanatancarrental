/** Format integer paise as INR for display. Display only; never used to compute a price. */
export const inr = (paise: number, locale: string) =>
  new Intl.NumberFormat(`${locale}-IN`, { style: "currency", currency: "INR" }).format(paise / 100);
