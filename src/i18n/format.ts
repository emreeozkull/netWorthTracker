import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const LOCALES: Record<string, string> = { en: 'en-US', tr: 'tr-TR' };

export function useFormat() {
  const { i18n } = useTranslation();
  const locale = LOCALES[i18n.language] ?? 'en-US';

  return useMemo(() => {
    const money = (value: number | undefined, currency: string, opts: { compact?: boolean } = {}) => {
      if (value === undefined || !Number.isFinite(value)) return '—';
      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
          notation: opts.compact ? 'compact' : 'standard',
          // Small unit prices (e.g. crypto fractions) keep extra precision.
          maximumFractionDigits: opts.compact ? 1 : value !== 0 && Math.abs(value) < 10 ? 4 : 2,
          minimumFractionDigits: opts.compact ? 0 : 2,
        }).format(value);
      } catch {
        return `${number(value)} ${currency}`;
      }
    };
    const number = (value: number | undefined, maxFraction = 6) =>
      value === undefined
        ? '—'
        : new Intl.NumberFormat(locale, { maximumFractionDigits: maxFraction }).format(value);
    const percent = (value: number) =>
      new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value);
    const date = (input: number | string) =>
      new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(
        typeof input === 'string' ? new Date(`${input}T00:00:00`) : new Date(input),
      );
    const dateTime = (ms: number) =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ms));
    return { locale, money, number, percent, date, dateTime };
  }, [locale]);
}

/** Parses user input that may use a comma decimal separator ("1.234,5" or "1234.5"). */
export function parseDecimal(input: string): number | undefined {
  let s = input.trim().replace(/\s/g, '');
  if (!s) return undefined;
  if (s.includes(',') && s.includes('.')) {
    // Whichever separator comes last is the decimal one.
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else {
    s = s.replace(',', '.');
  }
  if (!/^-?\d*\.?\d+$/.test(s) && !/^-?\d+\.?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}
