import { describe, it, expect } from 'vitest';
import { generateQRCodeSVG, generateQRCodeDataURL } from '../js/qrcode.js';

describe('Standalone QRCode Generator (qrcode.js)', () => {
  it('generates an SVG string representation of a QR code', async () => {
    const svg = await generateQRCodeSVG('00020126...6304ABCD');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox');
  });

  it('generates a universal SVG DataURL for img tags', async () => {
    const dataUrl = await generateQRCodeDataURL('teste-pix');
    expect(dataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true);
    expect(dataUrl).toContain('%3Csvg');
  });
});
