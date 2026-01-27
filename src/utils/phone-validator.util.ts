/**
 * Utilidades para validación y formateo de números de teléfono argentinos
 * Optimizado para WhatsApp
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formattedPhone?: string;
  whatsappJid?: string;
  isMobile?: boolean;
  hasWhatsApp?: boolean;
  displayFormat?: string;
  errors?: string[];
}

export interface PhoneFormatOptions {
  includeCountryCode?: boolean;
  displayFormat?: 'international' | 'national' | 'compact';
}

export class PhoneValidatorUtil {
  /**
   * Códigos de área de Argentina que corresponden a móviles
   * Incluye todos los códigos conocidos de telefonía móvil
   */
  private static MOBILE_AREA_CODES = [
    // Buenos Aires - CABA y Gran Buenos Aires
    '911',
    '915',
    '916',
    '920',
    '921',
    '922',
    '923',
    '924',
    '925',
    '926',
    '927',

    // Chubut - Comodoro Rivadavia, Rawson, Trelew
    '280',
    '281',

    // Santa Cruz y Tierra del Fuego
    '297',
    '299',

    // Mendoza
    '261',
    '263',
    '264',
    '266',

    // Córdoba
    '351',
    '353',
    '354',
    '358',

    // Santa Fe
    '376',
    '379',

    // Tucumán y NOA
    '381',
    '383',
    '385',
    '387',
    '388',

    // Buenos Aires - Interior
    '2202',
    '2221',
    '2223',
    '2224',
    '2225',
    '2226',
    '2227',
    '2241',
    '2242',
    '2243',
    '2244',
    '2245',
    '2246',
    '2252',
    '2254',
    '2255',
    '2257',
    '2266',
    '2267',
    '2268',
    '2271',
    '2272',
    '2281',
    '2283',
    '2284',
    '2285',
    '2286',
    '2291',
    '2292',
    '2296',
    '2297',
    '2302',
    '2316',
    '2317',
    '2320',
    '2323',
    '2324',
    '2325',
    '2326',
    '2331',
    '2333',
    '2334',
    '2335',
    '2336',
    '2337',
    '2338',
    '2392',
    '2393',
    '2394',
    '2395',
    '2396',

    // Mendoza - Interior
    '2622',
    '2623',
    '2624',
    '2625',
    '2626',
    '2627',
    '2634',
    '2635',
    '2636',
    '2637',
    '2645',
    '2646',
    '2647',
    '2648',
    '2651',
    '2655',
    '2656',
    '2657',

    // Patagonia
    '2902',
    '2920',
    '2921',
    '2922',
    '2924',
    '2926',
    '2928',
    '2929',
    '2931',
    '2932',
    '2933',
    '2934',
    '2935',
    '2936',
    '2940',
    '2942',
    '2944',
    '2945',
    '2946',
    '2948',
    '2952',
    '2953',
    '2954',
    '2962',
    '2963',
    '2964',
    '2966',

    // Centro y Cuyo
    '3327',
    '3329',
    '3382',
    '3385',
    '3387',
    '3388',
    '3400',
    '3401',
    '3402',
    '3403',
    '3404',
    '3405',
    '3406',
    '3407',
    '3408',
    '3409',
    '3435',
    '3436',
    '3437',
    '3438',
    '3442',
    '3444',
    '3445',
    '3446',
    '3447',
    '3454',
    '3455',
    '3456',
    '3460',
    '3462',
    '3463',
    '3464',
    '3465',
    '3466',
    '3467',
    '3468',
    '3469',
    '3471',
    '3472',
    '3476',
    '3482',
    '3483',
    '3487',
    '3489',
    '3491',
    '3492',
    '3493',
    '3496',
    '3497',
    '3498',
    '3541',
    '3542',
    '3543',
    '3544',
    '3562',
    '3563',
    '3564',
    '3571',
    '3572',
    '3573',
    '3574',
    '3575',
    '3576',
    '3582',
    '3583',
    '3584',
    '3585',

    // NOA
    '3711',
    '3715',
    '3716',
    '3718',
    '3722',
    '3725',
    '3731',
    '3734',
    '3735',
    '3743',
    '3751',
    '3754',
    '3755',
    '3756',
    '3757',
    '3758',
    '3782',
    '3841',
    '3843',
    '3844',
    '3845',
    '3854',
    '3855',
    '3856',
    '3857',
    '3858',
    '3861',
    '3862',
    '3863',
    '3865',
    '3867',
    '3868',
    '3869',
    '3876',
    '3877',
    '3878',
    '3886',
    '3887',
    '3888',
    '3891',
    '3892',
    '3894',
  ];

  /**
   * Códigos específicos de Chubut para validación explícita
   */
  private static CHUBUT_MOBILE_CODES = ['280', '281'];

  /**
   * Verifica específicamente si un número es de Chubut (móvil)
   */
  static isChubutMobile(phone: string): boolean {
    const cleaned = this.cleanPhoneNumber(phone);

    // Remover prefijos comunes
    let testNumber = cleaned;
    if (testNumber.startsWith('54')) testNumber = testNumber.substring(2);
    if (testNumber.startsWith('9')) testNumber = testNumber.substring(1);
    if (testNumber.startsWith('0')) testNumber = testNumber.substring(1);

    // Verificar códigos de Chubut
    return this.CHUBUT_MOBILE_CODES.some((code) => testNumber.startsWith(code));
  }

  /**
   * Función mejorada para detectar números móviles
   */
  static isMobileNumber(phone: string): boolean {
    const cleaned = this.cleanPhoneNumber(phone);

    if (cleaned.length < 10 || cleaned.length > 15) {
      return false;
    }

    // Casos especiales primero
    if (this.isChubutMobile(phone)) {
      return true;
    }

    // Verificar formatos comunes
    let testNumber = cleaned;

    // Si empieza con 54 (código país), remover
    if (testNumber.startsWith('54')) {
      testNumber = testNumber.substring(2);
    }

    // Si empieza con 9 (móvil), remover para verificar código de área
    if (testNumber.startsWith('9')) {
      testNumber = testNumber.substring(1);
    }

    // Si empieza con 0, remover
    if (testNumber.startsWith('0')) {
      testNumber = testNumber.substring(1);
    }

    // Verificar contra lista de códigos móviles
    return this.MOBILE_AREA_CODES.some((areaCode) =>
      testNumber.startsWith(areaCode),
    );
  }

  /**
   * Limpia un número de teléfono removiendo caracteres no numéricos
   */
  static cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Normaliza un número de teléfono argentino al formato internacional
   */
  static normalizeArgentinePhone(phone: string): string {
    let cleaned = this.cleanPhoneNumber(phone);

    // Si empieza con 54 (código de país), mantener
    if (cleaned.startsWith('54')) {
      return `+${cleaned}`;
    }

    // Si empieza con 0, remover el 0
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Casos especiales para números móviles argentinos:
    if (cleaned.startsWith('9')) {
      // Ya tiene el 9, mantener tal como está
      return `+54${cleaned}`;
    }

    // Verificar si es un número móvil que necesita el 9
    if (this.seemsLikeMobile(cleaned)) {
      // Para números de 10 dígitos que empiecen con código móvil
      if (cleaned.length === 10) {
        // Formato: 2804503151 → +549 + 2804503151
        return `+549${cleaned}`;
      }
    }

    // Agregar código de país sin modificar el número
    return `+54${cleaned}`;
  }

  /**
   * Determina si un número parece ser móvil basado en patrones conocidos
   * MEJORADO: Usa la función más robusta isMobileNumber
   */
  private static seemsLikeMobile(cleanedPhone: string): boolean {
    return this.isMobileNumber(cleanedPhone);
  }

  /**
   * Valida un número de teléfono argentino para WhatsApp
   */
  static validateArgentinePhone(phone: string): PhoneValidationResult {
    const errors: string[] = [];

    if (!phone || phone.trim() === '') {
      return {
        isValid: false,
        errors: ['Número de teléfono requerido'],
      };
    }

    const cleaned = this.cleanPhoneNumber(phone);

    // Verificar longitud mínima
    if (cleaned.length < 8) {
      errors.push('Número demasiado corto');
    }

    // Verificar longitud máxima
    if (cleaned.length > 15) {
      errors.push('Número demasiado largo');
    }

    try {
      const normalized = this.normalizeArgentinePhone(phone);
      const isMobile =
        this.seemsLikeMobile(cleaned) || normalized.includes('549');

      // En Argentina, asumimos que todos los móviles tienen WhatsApp
      const hasWhatsApp = isMobile;

      const whatsappJid = hasWhatsApp ? this.phoneToJid(normalized) : undefined;
      const displayFormat = this.formatForDisplay(normalized);

      return {
        isValid: errors.length === 0,
        formattedPhone: normalized,
        whatsappJid,
        isMobile,
        hasWhatsApp,
        displayFormat,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: ['Formato de número inválido'],
      };
    }
  }

  /**
   * Convierte un número de teléfono a JID de WhatsApp
   */
  static phoneToJid(phone: string): string {
    const normalized = this.normalizeArgentinePhone(phone);
    // Remover el + para el JID
    const phoneDigits = normalized.replace('+', '');
    return `${phoneDigits}@s.whatsapp.net`;
  }

  /**
   * Extrae el número de teléfono de un JID de WhatsApp
   */
  static jidToPhone(jid: string): string {
    const phoneDigits = jid.split('@')[0];
    return `+${phoneDigits}`;
  }

  /**
   * Formatea un número para mostrar al usuario
   */
  static formatForDisplay(
    phone: string,
    options: PhoneFormatOptions = {},
  ): string {
    const { displayFormat = 'national' } = options;
    const normalized = this.normalizeArgentinePhone(phone);

    // Remover +54 para el formato nacional
    let digits = normalized.replace('+54', '');

    // Si empieza con 9, es móvil
    if (digits.startsWith('9')) {
      digits = digits.substring(1); // Remover el 9
    }

    switch (displayFormat) {
      case 'international':
        return normalized;

      case 'compact':
        return digits;

      case 'national':
      default:
        // Formato: (280) 450-3151
        if (digits.length === 10) {
          const areaCode = digits.substring(0, 3);
          const firstPart = digits.substring(3, 6);
          const secondPart = digits.substring(6);
          return `(${areaCode}) ${firstPart}-${secondPart}`;
        } else if (digits.length >= 8) {
          const areaCode = digits.substring(0, 3);
          const firstPart = digits.substring(3, 6);
          const secondPart = digits.substring(6);
          return `(${areaCode}) ${firstPart}-${secondPart}`;
        }

        return digits;
    }
  }

  /**
   * Genera una máscara de entrada para números argentinos
   */
  static getInputMask(): string {
    return '(999) 999-9999';
  }

  /**
   * Genera un ejemplo de número para mostrar al usuario
   */
  static getExample(): string {
    return '(280) 450-3151';
  }

  /**
   * Genera placeholder text para el input
   */
  static getPlaceholder(): string {
    return 'Ej: (280) 450-3151 o +54 9 280 450-3151';
  }

  /**
   * Valida múltiples números de teléfono
   */
  static validateMultiplePhones(phones: string[]): PhoneValidationResult[] {
    return phones.map((phone) => this.validateArgentinePhone(phone));
  }

  /**
   * Determina si un número ya tiene WhatsApp verificado
   * (Esta función podría conectar con la API de WhatsApp Business en el futuro)
   */
  static async checkWhatsAppAvailability(phone: string): Promise<boolean> {
    // Por ahora, asumimos que todos los móviles argentinos tienen WhatsApp
    const validation = this.validateArgentinePhone(phone);
    return validation.isMobile || false;
  }

  /**
   * Convierte varios formatos de entrada a JID de WhatsApp
   */
  static anyFormatToJid(input: string): string | null {
    try {
      // Si ya es un JID, devolverlo
      if (input.includes('@s.whatsapp.net')) {
        return input;
      }

      // Validar y convertir
      const validation = this.validateArgentinePhone(input);
      return validation.whatsappJid || null;
    } catch {
      return null;
    }
  }
}

/**
 * Funciones de utilidad exportadas para uso directo
 */
export const validatePhoneNumber = PhoneValidatorUtil.validateArgentinePhone;
export const formatPhoneForDisplay = PhoneValidatorUtil.formatForDisplay;
export const phoneToWhatsAppJid = PhoneValidatorUtil.phoneToJid;
export const jidToPhoneNumber = PhoneValidatorUtil.jidToPhone;
export const getPhoneInputMask = PhoneValidatorUtil.getInputMask;
export const getPhoneExample = PhoneValidatorUtil.getExample;
export const getPhonePlaceholder = PhoneValidatorUtil.getPlaceholder;
