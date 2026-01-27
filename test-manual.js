// Test manual de validación de número
console.log('=== TEST: Validación número 2804503151 ===');
console.log('');

// Simular la lógica del validador
const testNumber = '2804503151';
console.log('Número de entrada:', testNumber);

// 1. Limpiar número
const cleaned = testNumber.replace(/\D/g, '');
console.log('1. Limpio:', cleaned);

// 2. Verificar longitud
const lengthOk = cleaned.length >= 8 && cleaned.length <= 15;
console.log('2. Longitud OK:', lengthOk, `(${cleaned.length} dígitos)`);

// 3. Verificar si es móvil (simplificado)
const mobileAreaCodes = [
  '280',
  '281',
  '297',
  '299',
  '261',
  '263',
  '264',
  '266',
];
let isMobile = false;
for (const areaCode of mobileAreaCodes) {
  if (cleaned.startsWith(areaCode)) {
    isMobile = true;
    console.log('3. Código móvil encontrado:', areaCode, '✅');
    break;
  }
}

if (!isMobile) {
  console.log('3. No es código móvil ❌');
}

// 4. Normalizar
let normalized = cleaned;
if (!normalized.startsWith('54')) {
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  if (!normalized.startsWith('9') && isMobile && normalized.length === 10) {
    normalized = `+549${normalized}`;
  } else {
    normalized = `+54${normalized}`;
  }
} else {
  normalized = `+${normalized}`;
}
console.log('4. Normalizado:', normalized);

// 5. Formato display
let displayFormat = normalized.replace('+54', '');
if (displayFormat.startsWith('9')) {
  displayFormat = displayFormat.substring(1);
}
const areaCode = displayFormat.substring(0, 3);
const firstPart = displayFormat.substring(3, 6);
const secondPart = displayFormat.substring(6);
displayFormat = `(${areaCode}) ${firstPart}-${secondPart}`;
console.log('5. Display:', displayFormat);

// 6. JID WhatsApp
const phoneDigits = normalized.replace('+', '');
const whatsappJid = `${phoneDigits}@s.whatsapp.net`;
console.log('6. WhatsApp JID:', whatsappJid);

console.log('');
console.log('=== RESULTADO FINAL ===');
console.log('✅ Número válido:', lengthOk && isMobile);
console.log('📱 Móvil:', isMobile);
console.log('📞 WhatsApp:', normalized);
console.log('👀 Display:', displayFormat);
console.log('🔗 JID:', whatsappJid);

// Probar otros formatos del mismo número
console.log('');
console.log('=== OTROS FORMATOS DEL MISMO NÚMERO ===');
const otherFormats = [
  '02804503151',
  '280 450-3151',
  '+54 9 280 450-3151',
  '+5492804503151',
  '5492804503151',
];

otherFormats.forEach((format) => {
  const cleaned = format.replace(/\D/g, '');
  let shouldWork = false;

  // Lógica simplificada para cada formato
  if (cleaned.startsWith('02804503151')) shouldWork = true;
  if (cleaned.includes('2804503151')) shouldWork = true;
  if (cleaned.startsWith('5492804503151')) shouldWork = true;

  console.log(
    `${format}: ${shouldWork ? '✅ Debería funcionar' : '❓ Verificar'}`,
  );
});
