import { describe, it, expect } from 'vitest';
import { csvCell } from '../js/utils.js';

describe('CSV Export & Security (csvCell)', () => {
  it('escapes regular text in double quotes', () => {
    expect(csvCell('Bolo de Chocolate')).toBe('"Bolo de Chocolate"');
  });

  it('escapes existing double quotes by doubling them', () => {
    expect(csvCell('Bolo "Especial" de Nozes')).toBe('"Bolo ""Especial"" de Nozes"');
  });

  it('neutralizes formula injection characters (=, +, -, @, \\t, \\r)', () => {
    // Fórmulas perigosas que poderiam executar comandos no Excel ou Calc
    expect(csvCell('=cmd|/C calc!A0')).toBe("\"'=cmd|/C calc!A0\"");
    expect(csvCell('+1+2')).toBe("\"'+1+2\"");
    expect(csvCell('-5+10')).toBe("\"'-5+10\"");
    expect(csvCell('@SUM(A1:A10)')).toBe("\"'@SUM(A1:A10)\"");
    expect(csvCell('\tTAB_PREFIX')).toBe("\"'\tTAB_PREFIX\"");
  });

  it('handles null, undefined and empty values safely', () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell('')).toBe('""');
  });

  it('handles numbers and booleans correctly', () => {
    expect(csvCell(123.45)).toBe('"123.45"');
    expect(csvCell(0)).toBe('"0"');
    expect(csvCell(true)).toBe('"true"');
  });
});
