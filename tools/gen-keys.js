/**
 * tools/gen-keys.js
 * Utilitário para gerar o par de chaves criptográficas ECDSA P-256 (Web Crypto / Node.js)
 * 
 * - Chave Privada: Usada exclusivamente no Cloudflare Worker (secret LICENSE_PRIVATE_KEY)
 * - Chave Pública: Embutida no cliente Confeitex (js/license.js) para validação matemática de licenças
 */

const { webcrypto } = require('crypto');

async function generateKeyPair() {
  const subtle = webcrypto.subtle;

  console.log('Gerando par de chaves ECDSA P-256...');
  const keyPair = await subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    true, // exportable
    ['sign', 'verify']
  );

  const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);
  const publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);

  const privateKeyStr = JSON.stringify(privateJwk);
  const publicKeyStr = JSON.stringify(publicJwk);

  console.log('\n============================================================');
  console.log('✅ CHAVE PÚBLICA (Embutida no Frontend / js/license.js):');
  console.log('============================================================');
  console.log(publicKeyStr);

  console.log('\n============================================================');
  console.log('🔒 CHAVE PRIVADA (Cadastrar no Cloudflare Secret LICENSE_PRIVATE_KEY):');
  console.log('============================================================');
  console.log(privateKeyStr);
  console.log('\nGuarde a chave privada em segredo absoluto!');

  return { privateJwk, publicJwk };
}

generateKeyPair().catch(console.error);
