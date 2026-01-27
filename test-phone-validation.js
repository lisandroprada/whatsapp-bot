import { PhoneValidatorUtil } from './src/utils/phone-validator.util.js';

console.log('Testing phone validation for: 2804503151');
console.log('');

const testNumber = '2804503151';
const result = PhoneValidatorUtil.validateArgentinePhone(testNumber);

console.log('Input:', testNumber);
console.log('Cleaned:', PhoneValidatorUtil.cleanPhoneNumber(testNumber));

// Test internal functions
const cleaned = PhoneValidatorUtil.cleanPhoneNumber(testNumber);
console.log('Length:', cleaned.length);

// Check if it matches mobile area codes
const mobileAreaCodes = ['280', '281', '297', '299']; // Some mobile codes
for (const areaCode of mobileAreaCodes) {
  if (cleaned.startsWith(areaCode)) {
    console.log(`Matches mobile area code: ${areaCode} ✅`);
  }
}

console.log('');
console.log('Validation result:');
console.log(JSON.stringify(result, null, 2));

// Test other formats
console.log('');
console.log('Testing other formats of the same number:');
const formats = [
  '2804503151',
  '02804503151',
  '280 15 4503151',
  '280 450-3151',
  '+54 9 280 450-3151',
  '+5492804503151',
  '5492804503151',
];

formats.forEach((format) => {
  const result = PhoneValidatorUtil.validateArgentinePhone(format);
  console.log(
    `${format}: ${result.isValid ? '✅' : '❌'} ${result.isValid ? result.displayFormat : result.errors?.join(', ')}`,
  );
});
