import { describe, it, expect } from 'vitest';
import { parseExpiryDate } from './dateOcr';

describe('parseExpiryDate', () => {
  it('parses full day-precision dates (DD.MM.YYYY)', () => {
    expect(parseExpiryDate('15.08.2026')).toEqual({ date: '2026-08-15', precision: 'day' });
  });

  it('parses dates with surrounding noise (MHD prefix)', () => {
    expect(parseExpiryDate('MHD 31.12.2026')).toEqual({ date: '2026-12-31', precision: 'day' });
    expect(parseExpiryDate('best before: 28.02.2027')).toEqual({ date: '2027-02-28', precision: 'day' });
  });

  it('expands two-digit years into the 2000s (expiry dates are future)', () => {
    expect(parseExpiryDate('01.09.25')).toEqual({ date: '2025-09-01', precision: 'day' });
    expect(parseExpiryDate('01.09.99')).toEqual({ date: '2099-09-01', precision: 'day' });
  });

  it('rejects impossible calendar days instead of silently shifting them', () => {
    // 2026-02-31 would roll over to 2026-03-03 if accepted — must not happen.
    expect(parseExpiryDate('31.02.2026')?.date).not.toBe('2026-02-31');
    expect(parseExpiryDate('31.04.2027')?.date).not.toBe('2027-04-31');
    // valid edge days still parse as day precision
    expect(parseExpiryDate('28.02.2026')).toEqual({ date: '2026-02-28', precision: 'day' });
    expect(parseExpiryDate('29.02.2028')).toEqual({ date: '2028-02-29', precision: 'day' });
  });

  it('parses a named month with no separator (dez2026)', () => {
    expect(parseExpiryDate('dez2026')).toEqual({ date: '2026-12-31', precision: 'month' });
  });

  it('parses ISO dates (YYYY-MM-DD)', () => {
    expect(parseExpiryDate('2026-12-31')).toEqual({ date: '2026-12-31', precision: 'day' });
  });

  it('parses month precision (MM.YYYY) to last day of month', () => {
    expect(parseExpiryDate('12.2026')).toEqual({ date: '2026-12-31', precision: 'month' });
    expect(parseExpiryDate('03/2027')).toEqual({ date: '2027-03-31', precision: 'month' });
    expect(parseExpiryDate('06.2028')).toEqual({ date: '2028-06-30', precision: 'month' });
  });

  it('does not let a lot-code prefix corrupt month precision', () => {
    expect(parseExpiryDate('L 04.2026')).toEqual({ date: '2026-04-30', precision: 'month' });
  });

  it('parses named months', () => {
    expect(parseExpiryDate('mar 2027')).toEqual({ date: '2027-03-31', precision: 'month' });
    expect(parseExpiryDate('dez 2026')).toEqual({ date: '2026-12-31', precision: 'month' });
  });

  it('parses month and space-separated year', () => {
    expect(parseExpiryDate('09 2027')).toEqual({ date: '2027-09-30', precision: 'month' });
  });

  it('falls back to a bare year', () => {
    expect(parseExpiryDate('2029')).toEqual({ date: '2029-12-31', precision: 'year' });
  });

  it('rejects invalid months', () => {
    // 13 is not a valid month; "13.2026" has no valid interpretation here
    const result = parseExpiryDate('13.99');
    expect(result).toBeNull();
  });

  it('returns null for empty or junk input', () => {
    expect(parseExpiryDate('')).toBeNull();
    expect(parseExpiryDate('keine zahlen hier')).toBeNull();
  });
});
