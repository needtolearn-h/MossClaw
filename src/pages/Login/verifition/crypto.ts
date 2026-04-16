import CryptoJS from 'crypto-js';

/**
 * AES encrypt (ECB mode, PKCS7 padding)
 * Matches the Vue component's encryption behavior
 */
export function aesEncrypt(word: string, keyWord = 'XwKsGlMcdPMEhR1B'): string {
  const key = CryptoJS.enc.Utf8.parse(keyWord);
  const srcs = CryptoJS.enc.Utf8.parse(word);
  const encrypted = CryptoJS.AES.encrypt(srcs, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  });
  return encrypted.toString();
}
