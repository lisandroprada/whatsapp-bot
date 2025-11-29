import { Injectable, Logger } from '@nestjs/common';

/**
 * Mock del Core Backend para desarrollo y testing
 * Simula las respuestas del backend real mientras se implementan los endpoints
 */
@Injectable()
export class CoreBackendMockService {
  private readonly logger = new Logger(CoreBackendMockService.name);

  // Base de datos simulada de clientes
  private mockClients = {
    '5492804503151@s.whatsapp.net': {
      id: 'client_001',
      name: 'Juan Pérez',
      dni: '12345678',
      email: 'juan.perez@example.com',
      phone: '+5492804503151',
      whatsappJid: '5492804503151@s.whatsapp.net',
      properties: [
        {
          id: 'prop_001',
          address: 'Av. Libertador 1234, CABA',
          type: 'apartment',
          currentBalance: -50000,
        },
      ],
    },
    '5491198765432@s.whatsapp.net': {
      id: 'client_002',
      name: 'María González',
      dni: '87654321',
      email: 'maria.gonzalez@example.com',
      phone: '+5491198765432',
      whatsappJid: '5491198765432@s.whatsapp.net',
      properties: [
        {
          id: 'prop_002',
          address: 'Calle Corrientes 5678, CABA',
          type: 'house',
          currentBalance: 0,
        },
      ],
    },
  };

  /**
   * Mock: Obtener cliente por JID de WhatsApp
   */
  async getClientByJid(jid: string) {
    this.logger.log(`[MOCK] getClientByJid: ${jid}`);

    const client = this.mockClients[jid];

    if (client) {
      return client;
    }

    return null; // Cliente no encontrado
  }

  /**
   * Mock: Obtener estado de cuenta
   */
  async getAccountStatus(clientId: string) {
    this.logger.log(`[MOCK] getAccountStatus: ${clientId}`);

    // Buscar cliente por ID
    const client = Object.values(this.mockClients).find(
      (c) => c.id === clientId,
    );

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    return {
      clientId: client.id,
      clientName: client.name,
      balance: client.properties[0].currentBalance,
      nextPaymentDue: '2025-12-05',
      lastPayment: {
        amount: 150000,
        date: '2025-11-03',
        method: 'transfer',
      },
      properties: client.properties,
    };
  }

  /**
   * Mock: Registrar pago
   */
  async reportPayment(data: {
    clientId: string;
    amount: number;
    date: string;
    receiptUrl?: string;
    method: 'transfer' | 'cash' | 'check';
  }) {
    this.logger.log(`[MOCK] reportPayment:`, data);

    return {
      success: true,
      paymentId: `payment_${Date.now()}`,
      message: 'Pago registrado exitosamente (MOCK)',
      receiptSentTo: 'email',
    };
  }

  /**
   * Mock: Crear reclamo
   */
  async createComplaint(data: {
    clientId: string;
    propertyId?: string;
    category: 'plumbing' | 'electric' | 'heating' | 'cleaning' | 'security' | 'other';
    description: string;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
    evidenceUrls?: string[];
    whatsappJid?: string;
  }) {
    this.logger.log(`[MOCK] createComplaint:`, data);

    return {
      success: true,
      ticketId: `ticket_${Date.now()}`,
      message: 'Reclamo creado exitosamente. Nuestro equipo lo revisará pronto.',
      ticket: {
        id: `ticket_${Date.now()}`,
        category: data.category,
        urgency: data.urgency,
        status: 'open',
        createdAt: new Date(),
      },
    };
  }

  /**
   * Mock: Validar identidad (DNI/CUIT)
   */
  async validateIdentity(dni: string, jid: string) {
    this.logger.log(`[MOCK] validateIdentity: DNI=${dni}, JID=${jid}`);

    // Simular búsqueda por DNI
    const client = Object.values(this.mockClients).find((c) => c.dni === dni);

    if (!client) {
      throw new Error('No se encontró cliente con ese DNI');
    }

    return {
      clientId: client.id,
      name: client.name,
      otpSent: true,
      otpMethod: 'email',
      message: 'Código OTP enviado (MOCK)',
    };
  }

  /**
   * Mock: Verificar código OTP
   */
  async verifyOTP(dni: string, otp: string, jid: string) {
    this.logger.log(`[MOCK] verifyOTP: DNI=${dni}, OTP=${otp}, JID=${jid}`);

    // Simular validación de OTP (cualquier código de 4 dígitos es válido)
    if (otp.length !== 4 || isNaN(Number(otp))) {
      throw new Error('Código OTP inválido');
    }

    const client = Object.values(this.mockClients).find((c) => c.dni === dni);

    if (!client) {
      throw new Error('Cliente no encontrado');
    }

    return {
      success: true,
      clientId: client.id,
      message: 'Cuenta vinculada exitosamente (MOCK)',
    };
  }

  /**
   * Mock: Vincular WhatsApp a cliente
   */
  async linkWhatsappToClient(clientId: string, jid: string) {
    this.logger.log(
      `[MOCK] linkWhatsappToClient: ClientID=${clientId}, JID=${jid}`,
    );

    return {
      success: true,
      message: 'WhatsApp vinculado correctamente (MOCK)',
    };
  }

  /**
   * Mock: Buscar propiedades (futuro)
   */
  async searchProperties(filters: any) {
    this.logger.log(`[MOCK] searchProperties:`, filters);

    // Retornamos un array directo como espera el SearchPropertiesTool
    return [
      {
        id: 'prop_003',
        title: 'Departamento 2 ambientes en Palermo (VERIFICADO)',
        address: 'Av. Santa Fe 3456',
        zone: 'Palermo',
        type: 'apartment',
        rooms: 2,
        price: 180000,
        currency: 'ARS',
        surface: 50,
        url: 'https://propietas.com/prop/003'
      },
      {
        id: 'prop_004',
        title: 'Casa 3 ambientes en Zona Norte (TEST)',
        address: 'Calle Olivos 789',
        zone: 'Norte',
        type: 'house',
        rooms: 3,
        price: 250000,
        currency: 'ARS',
        surface: 120,
        url: 'https://propietas.com/prop/004'
      },
    ];
  }

  /**
   * Mock: Obtener ciudades con propiedades disponibles
   */
  async getAvailableCities() {
    this.logger.log(`[MOCK] getAvailableCities`);
    
    return [
      { city: 'Rawson', rent: 6, sale: 1 },
      { city: 'Playa Unión', rent: 2, sale: 0 },
    ];
  }

  /**
   * Mock: Agendar visita (futuro)
   */
  async scheduleShowing(data: any) {
    this.logger.log(`[MOCK] scheduleShowing:`, data);

    return {
      success: true,
      showingId: `showing_${Date.now()}`,
      confirmationSent: true,
      message: 'Visita agendada exitosamente (MOCK)',
    };
  }
}
