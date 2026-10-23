import QRCode from 'qrcode';

export async function generateQRCodeSVG(text, options = {}) {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 1,
    width: options.width || 240,
    color: {
      dark: options.dark || '#000000',
      light: options.light || '#ffffff'
    },
    ...options
  });
}

export async function generateQRCodeDataURL(text, options = {}) {
  const svg = await generateQRCodeSVG(text, options);
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}
