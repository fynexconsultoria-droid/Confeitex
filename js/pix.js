/**
 * Confeitex — pix.js
 * Gerador de Pix Estático (BR Code) padrão Banco Central do Brasil (EMV QRCPS-MPM).
 * 100% local, offline, seguro e compatível com qualquer banco (Nubank, Inter, Itaú, BB, Caixa, etc).
 */

// Cálculo do CRC16-CCITT (Polinômio 0x1021, valor inicial 0xFFFF) exigido pelo BACEN
export function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function emvField(id, value) {
  if (value === null || value === undefined || value === '') return '';
  const str = String(value);
  const len = String(str.length).padStart(2, '0');
  return `${id}${len}${str}`;
}

export function cleanText(text, maxLen = 25) {
  if (!text) return '';
  // Remove acentos e caracteres especiais para evitar problemas em leitores bancários rígidos
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .slice(0, maxLen);
}

/**
 * Normaliza a chave Pix para o padrão do BACEN
 */
export function normalizePixKey(key) {
  if (!key) return '';
  const trimmed = key.trim();
  // Se for apenas dígitos (CPF/CNPJ/Telefone)
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.includes('@')) {
    // E-mail
    return trimmed.toLowerCase();
  }
  if (digits.length === 11) {
    // Pode ser CPF ou celular sem código de país
    // Se o usuário digitou telefone com DDD (11 dígitos), o BACEN exige +55 no telefone
    // Mas se for CPF, são 11 dígitos puros
    // Se tiver traço ou ponto, sabemos distinguir
    if (trimmed.includes('.') || trimmed.includes('-')) {
      return digits; // CPF
    }
    // Heurística segura: se começar com dígito 9 no 3º caractere (ex: 11988887777), é celular
    if (digits[2] === '9') {
      return `+55${digits}`;
    }
    return digits; // CPF
  }
  if (digits.length === 14) {
    // CNPJ
    return digits;
  }
  if (trimmed.startsWith('+55')) {
    return trimmed;
  }
  // Chave aleatória (EVP) ou outro formato
  return trimmed;
}

/**
 * Gera a string do Pix Copia e Cola (BR Code)
 * @param {Object} params
 * @param {string} params.key - Chave Pix
 * @param {string} params.name - Nome do recebedor (max 25 letras)
 * @param {string} params.city - Cidade do recebedor (max 15 letras)
 * @param {number|string} [params.amount] - Valor em reais (ex: 85.50)
 * @param {string} [params.txid] - Identificador único da transação (max 25 letras ou '***')
 * @param {string} [params.description] - Descrição opcional (ex: Encomenda #123)
 */
export function generatePixPayload({ key, name, city, amount, txid, description }) {
  if (!key) throw new Error('Chave Pix é obrigatória.');

  const pixKey = normalizePixKey(key);
  const merchantName = cleanText(name || 'CONFEITARIA', 25) || 'CONFEITARIA';
  const merchantCity = cleanText(city || 'BRASIL', 15) || 'BRASIL';
  const reference = cleanText(txid || '***', 25) || '***';

  // Sub-campos Merchant Account Information (ID 26)
  let subAccount = emvField('00', 'br.gov.bcb.pix');
  subAccount += emvField('01', pixKey);
  if (description) {
    subAccount += emvField('02', cleanText(description, 40));
  }
  const accountInfo = emvField('26', subAccount);

  // Demais campos obrigatórios
  const formatIndicator = emvField('00', '01'); // Padrão
  const merchantCategory = emvField('52', '0000'); // Padrão
  const currency = emvField('53', '986'); // BRL

  // Valor (opcional no padrão estático, mas muito útil para encomendas)
  let amountField = '';
  if (amount !== undefined && amount !== null && amount !== '') {
    const num = Number(amount);
    if (!isNaN(num) && num > 0) {
      amountField = emvField('54', num.toFixed(2));
    }
  }

  const country = emvField('58', 'BR');
  const merchantNameField = emvField('59', merchantName);
  const merchantCityField = emvField('60', merchantCity);

  // Informações adicionais (ID 62): txid (campo 05)
  const subAdditional = emvField('05', reference);
  const additionalData = emvField('62', subAdditional);

  // Montagem prévia (sem o CRC)
  const partial = `${formatIndicator}${accountInfo}${merchantCategory}${currency}${amountField}${country}${merchantNameField}${merchantCityField}${additionalData}6304`;
  const checksum = crc16(partial);

  return `${partial}${checksum}`;
}
