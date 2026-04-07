import { Injectable, Logger, HttpException } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CoreBackendMockService } from './core-backend-mock.service';

/**
 * Servicio para comunicación con el Core Backend de la inmobiliaria
 * Utiliza API Key para autenticación (service-to-service)
 * Soporta modo MOCK para desarrollo cuando el Core Backend no está disponible
 */
@Injectable()
export class CoreBackendService {
  private readonly logger = new Logger(CoreBackendService.name);
  private readonly client: AxiosInstance;
  private readonly useMock: boolean;
  private readonly mockService: CoreBackendMockService;
  private readonly baseURL: string;

  constructor() {
    const baseURL = process.env.CORE_BACKEND_URL;
    const apiKey = process.env.WHATSAPP_BOT_API_KEY; // Cambiado de CORE_BACKEND_API_KEY

    // Determinar si usar mock
    this.useMock =
      !baseURL || !apiKey || apiKey === 'development-key-temp-mock';
    this.baseURL = baseURL || 'http://localhost:3050';

    if (this.useMock) {
      this.logger.warn(
        '⚠️  MOCK MODE ENABLED - Using simulated Core Backend responses',
      );
      this.mockService = new CoreBackendMockService();
    } else {
      this.logger.log(`Core Backend URL: ${baseURL}`);
    }

    this.client = axios.create({
      baseURL: baseURL || 'http://localhost:3050',
      timeout: 10000,
      headers: {
        'x-api-key': apiKey || 'development-key', // Cambiado de x-service-api-key
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para logging de requests
    this.client.interceptors.request.use((config) => {
      this.logger.log(
        `[Core Request] ${config.method?.toUpperCase()} ${config.url}`,
      );
      return config;
    });

    // Interceptor para logging de responses y errores
    this.client.interceptors.response.use(
      (response) => {
        this.logger.log(
          `[Core Response] ${response.status} ${response.config.url}`,
        );
        return response;
      },
      (error) => {
        this.logger.error(
          `[Core Error] ${error.response?.status || 'NETWORK'} ${error.config?.url}`,
          error.message,
        );
        throw error;
      },
    );
  }

  // ========== Endpoints Administrativos ==========

  /**
   * Obtener información del cliente por JID de WhatsApp
   * Endpoint Core: GET /api/v1/bot/client/by-jid/:jid
   */
  async getClientByJid(jid: string) {
    // Usar mock si está habilitado
    if (this.useMock) {
      return this.mockService.getClientByJid(jid);
    }

    try {
      const response = await this.client.get(
        `/api/v1/bot/client/by-jid/${jid}`,
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Cliente no encontrado
      }
      throw new HttpException(
        'Error al consultar cliente en Core Backend',
        error.response?.status || 500,
      );
    }
  }

  /**
   * Obtener saldo y estado de cuenta
   * Endpoint Core: GET /api/v1/bot/client/:clientId/balance
   */
  async getAccountStatus(clientId: string) {
    if (this.useMock) {
      return this.mockService.getAccountStatus(clientId);
    }

    try {
      const response = await this.client.get(
        `/api/v1/bot/client/${clientId}/balance`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to get account status for client ${clientId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Registrar pago reportado por el cliente
   * Endpoint Core: POST /api/payments/report
   */
  async reportPayment(data: {
    clientId: string;
    amount: number;
    date: string;
    receiptUrl?: string;
    method: 'transfer' | 'cash' | 'check';
  }) {
    if (this.useMock) {
      return this.mockService.reportPayment(data);
    }

    try {
      const response = await this.client.post('/api/payments/report', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to report payment', error);
      throw error;
    }
  }

  /**
   * Crear ticket de reclamo
   * Endpoint Core: POST /api/v1/bot/client/:clientId/complaints
   */
  async createComplaint(data: {
    clientId: string;
    propertyId?: string;
    category:
      | 'plumbing'
      | 'electric'
      | 'heating'
      | 'cleaning'
      | 'security'
      | 'other';
    description: string;
    urgency: 'low' | 'medium' | 'high' | 'urgent';
    evidenceUrls?: string[];
    whatsappJid?: string;
  }) {
    if (this.useMock) {
      return this.mockService.createComplaint(data);
    }

    try {
      const { clientId, ...complaintData } = data;
      const response = await this.client.post(
        `/api/v1/bot/client/${clientId}/complaints`,
        complaintData,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create complaint', error);
      throw error;
    }
  }

  // ========== Validación de Identidad ==========

  /**
   * Validar DNI/CUIT y generar OTP
   * Endpoint Core: POST /api/v1/bot/auth/validate-identity
   */
  async validateIdentity(dni: string, jid: string) {
    if (this.useMock) {
      return this.mockService.validateIdentity(dni, jid);
    }

    try {
      const response = await this.client.post(
        '/api/v1/bot/auth/validate-identity',
        {
          dni,
          whatsappJid: jid,
        },
      );
      return response.data; // { success, clientId, clientName, emailSent, maskedEmail, expiresAt, message }
    } catch (error) {
      this.logger.error(`Failed to validate identity for DNI ${dni}`, error);
      throw error;
    }
  }

  /**
   * Verificar código OTP
   * Endpoint Core: POST /api/v1/bot/auth/verify-otp
   */
  async verifyOTP(dni: string, otp: string, jid: string) {
    if (this.useMock) {
      return this.mockService.verifyOTP(dni, otp, jid);
    }

    try {
      const response = await this.client.post('/api/v1/bot/auth/verify-otp', {
        whatsappJid: jid,
        otp,
      });
      return response.data; // { success, clientId, clientName, message }
    } catch (error) {
      this.logger.error('Failed to verify OTP', error);
      throw error;
    }
  }

  /**
   * Vincular JID de WhatsApp con cliente
   * Endpoint Core: POST /api/clients/:clientId/link-whatsapp
   */
  async linkWhatsappToClient(clientId: string, jid: string) {
    try {
      const response = await this.client.post(
        `/api/clients/${clientId}/link-whatsapp`,
        {
          whatsappJid: jid,
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to link WhatsApp JID to client ${clientId}`,
        error,
      );
      throw error;
    }
  }

  // ========== Endpoints Comerciales (Futuro) ==========

  /**
   * Buscar propiedades disponibles
   * Endpoint Core: GET /api/v1/bot/properties/search
   */
  async searchProperties(filters: {
    zone?: string;
    type?: 'apartment' | 'house' | 'duplex';
    city?: string;
    rooms?: number;
    minPrice?: number;
    maxPrice?: number;
    operation?: 'rent' | 'sale';
  }) {
    if (this.useMock) {
      return this.mockService.searchProperties(filters);
    }

    try {
      const response = await this.client.get('/api/v1/bot/properties/search', {
        params: filters,
      });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to search properties', error);
      throw error;
    }
  }

  /**
   * Obtener ciudades con propiedades disponibles
   * Endpoint Core: GET /api/v1/bot/properties/cities
   */
  async getAvailableCities() {
    if (this.useMock) {
      return this.mockService.getAvailableCities();
    }

    try {
      const response = await this.client.get('/api/v1/bot/properties/cities');
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get available cities', error);
      throw error;
    }
  }

  /**
   * Crear un agente PROSPECT provisional para un usuario desconocido
   * Endpoint Core: POST /api/v1/bot/prospects
   */
  async createProspect(data: { name: string; phone: string; jid?: string }) {
    if (this.useMock) {
      const id = Math.random().toString(16).slice(2, 10).toUpperCase();
      return { id: `mock-${id}`, documentNumber: `PROSPECT-${id}`, name: data.name };
    }

    try {
      const response = await this.client.post('/api/v1/bot/prospects', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create prospect', error);
      throw error;
    }
  }

  /**
   * Iniciar solicitud de visita (pre-calificación)
   * Endpoint Core: POST /api/v1/bot/showings/request
   */
  async requestShowing(data: {
    propertyId?: string;
    propertyAddress?: string;
    preferredDate?: string;
    clientName?: string;
    clientJid?: string;
    clientCoreId?: string;
  }) {
    if (this.useMock) {
      return this.mockService.requestShowing(data);
    }

    try {
      const response = await this.client.post('/api/v1/bot/showings/request', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to request showing', error);
      throw error;
    }
  }

  /**
   * Adjuntar documento de pre-calificación a un caso
   * Endpoint Core: POST /api/v1/bot/showings/:caseId/documents
   */
  async attachShowingDocument(
    caseId: string,
    data: { docType: string; fileUrl: string; fileName: string },
  ) {
    if (this.useMock) {
      return { success: true };
    }

    try {
      const response = await this.client.post(
        `/api/v1/bot/showings/${caseId}/documents`,
        data,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to attach showing document', error);
      throw error;
    }
  }

  /**
   * Probar envío de email
   * Endpoint Core: POST /api/v1/email/test
   */
  async testEmail(email: string) {
    try {
      const response = await this.client.post('/api/v1/email/test', { email });
      return response.data;
    } catch (error) {
      this.logger.error('Failed to send test email', error);
      throw error;
    }
  }

  /**
   * Agendar visita o reunión
   * Endpoint Core: POST /api/showings
   */
  async scheduleShowing(data: {
    type: 'showing' | 'meeting';
    propertyId?: string;
    clientName: string;
    clientPhone: string;
    preferredDate: string;
    notes?: string;
  }) {
    if (this.useMock) {
      return this.mockService.scheduleShowing(data);
    }

    try {
      const response = await this.client.post('/api/v1/bot/showings', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to schedule showing', error);
      throw error;
    }
  }

  // ========== Gestión de Números WhatsApp ==========

  /**
   * Actualizar número de WhatsApp de un cliente
   * Endpoint Core: PUT /api/v1/bot/client/:clientId/whatsapp
   */
  async updateClientWhatsApp(
    clientId: string,
    data: {
      phone: string;
      whatsappJid?: string;
      autoDetected?: boolean;
      verified?: boolean;
    },
  ) {
    if (this.useMock) {
      return this.mockService.updateClientWhatsApp(clientId, data);
    }

    try {
      const response = await this.client.put(
        `/api/v1/bot/client/${clientId}/whatsapp`,
        data,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to update WhatsApp number for client ${clientId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtener información de WhatsApp de un cliente
   * Endpoint Core: GET /api/v1/bot/client/:clientId/whatsapp
   */
  async getClientWhatsApp(clientId: string) {
    if (this.useMock) {
      return this.mockService.getClientWhatsApp(clientId);
    }

    try {
      const response = await this.client.get(
        `/api/v1/bot/client/${clientId}/whatsapp`,
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Cliente no tiene WhatsApp configurado
      }
      this.logger.error(
        `Failed to get WhatsApp info for client ${clientId}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Verificar disponibilidad de WhatsApp para un número
   * Endpoint Core: POST /api/v1/bot/whatsapp/verify
   */
  async verifyWhatsAppNumber(phone: string) {
    if (this.useMock) {
      return this.mockService.verifyWhatsAppNumber(phone);
    }

    try {
      const response = await this.client.post('/api/v1/bot/whatsapp/verify', {
        phone,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to verify WhatsApp number ${phone}`, error);
      throw error;
    }
  }

  /**
   * Sincronizar números de WhatsApp con contactos detectados
   * Endpoint Core: POST /api/v1/bot/whatsapp/sync-contacts
   */
  async syncWhatsAppContacts(
    contacts: Array<{
      jid: string;
      phone: string;
      name?: string;
      verified: boolean;
    }>,
  ) {
    if (this.useMock) {
      return this.mockService.syncWhatsAppContacts(contacts);
    }

    try {
      const response = await this.client.post(
        '/api/v1/bot/whatsapp/sync-contacts',
        { contacts },
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to sync WhatsApp contacts', error);
      throw error;
    }
  }

  // ========== Contact Search ==========

  /**
   * Search contacts (Agents) by name within a company.
   * Endpoint Core: GET /api/v1/bot/contacts/search?name=&companyId=
   */
  async searchContacts(name: string, companyId: string) {
    if (this.useMock) {
      return {
        contacts: [
          { id: 'mock-1', name: 'Mock Contact', firstName: 'Mock', lastName: 'Contact', phones: ['2800000000'], primaryPhone: '2800000000', email: null },
        ],
      };
    }

    try {
      const response = await this.client.get('/api/v1/bot/contacts/search', {
        params: { name, companyId },
      });
      return response.data; // { contacts: [...] }
    } catch (error) {
      this.logger.error(`Failed to search contacts for name "${name}"`, error);
      return { contacts: [] };
    }
  }

  // ========== Operator Endpoints ==========

  /**
   * Resolve if a JID belongs to an operator
   * Endpoint Core: GET /api/v1/bot/agents/resolve-operator/:jid
   */
  async resolveOperator(jid: string) {
    if (this.useMock) {
      return this.mockService.resolveOperator(jid);
    }

    try {
      const response = await this.client.get(
        `/api/v1/bot/agents/resolve-operator/${encodeURIComponent(jid)}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to resolve operator for JID ${jid}`, error);
      return { isOperator: false };
    }
  }

  /**
   * Get work orders for an operator
   * Endpoint Core: GET /api/v1/bot/operators/:agentId/work-orders
   */
  async getOperatorWorkOrders(agentId: string, status?: string) {
    if (this.useMock) {
      return this.mockService.getOperatorWorkOrders(agentId, status);
    }

    try {
      const response = await this.client.get(
        `/api/v1/bot/operators/${agentId}/work-orders`,
        { params: status ? { status } : {} },
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get work orders for agent ${agentId}`, error);
      throw error;
    }
  }

  /**
   * Create a work order via operator bot
   * Endpoint Core: POST /api/v1/bot/operators/work-orders
   */
  async createOperatorWorkOrder(data: {
    agentId: string;
    description: string;
    urgency?: string;
    propertyReference?: string;
  }) {
    if (this.useMock) {
      return this.mockService.createOperatorWorkOrder(data);
    }

    try {
      const response = await this.client.post(
        '/api/v1/bot/operators/work-orders',
        data,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create operator work order', error);
      throw error;
    }
  }

  // ========== Agenda Endpoints ==========

  /**
   * Get the agenda for a given day (formatted text + raw events).
   * Endpoint Core: GET /api/v1/bot/operators/agenda?companyId=&date=
   */
  async getOperatorAgenda(companyId: string, date?: string, userId?: string) {
    try {
      const response = await this.client.get('/api/v1/bot/operators/agenda', {
        params: { companyId, date, userId },
      });
      return response.data; // { events, text }
    } catch (error) {
      this.logger.error('Failed to get operator agenda', error);
      return { events: [], text: 'No se pudo obtener la agenda en este momento.' };
    }
  }

  /**
   * Create a scheduled action from the bot.
   * dateText can be natural language ("mañana a las 10") or ISO string.
   * Endpoint Core: POST /api/v1/bot/operators/agenda
   */
  async createOperatorAction(data: {
    companyId: string;
    userId: string;
    title: string;
    dateText: string;
    type?: string;
    notes?: string;
    assignedToUserId?: string;
  }) {
    try {
      const response = await this.client.post('/api/v1/bot/operators/agenda', data);
      return response.data; // { success, actionId, message }
    } catch (error) {
      this.logger.error('Failed to create operator action', error);
      return { success: false, message: 'No se pudo crear el evento.' };
    }
  }

  /**
   * Update an existing scheduled action (reschedule, rename, etc).
   * Endpoint Core: PUT /api/v1/bot/operators/agenda/:id
   */
  async updateOperatorAction(
    actionId: string,
    companyId: string,
    data: { title?: string; dateText?: string; type?: string; notes?: string },
  ) {
    try {
      const response = await this.client.put(
        `/api/v1/bot/operators/agenda/${actionId}`,
        { companyId, ...data },
      );
      return response.data; // { success, actionId, message }
    } catch (error) {
      this.logger.error(`Failed to update action ${actionId}`, error);
      return { success: false, message: 'No se pudo actualizar el evento.' };
    }
  }

  /**
   * Mark a scheduled action as done.
   * Endpoint Core: PUT /api/v1/bot/operators/agenda/:id/done
   */
  async markOperatorActionDone(actionId: string, companyId: string) {
    try {
      const response = await this.client.put(
        `/api/v1/bot/operators/agenda/${actionId}/done`,
        { companyId },
      );
      return response.data; // { success, message }
    } catch (error) {
      this.logger.error(`Failed to mark action ${actionId} as done`, error);
      return { success: false, message: 'No se pudo actualizar el evento.' };
    }
  }

  /**
   * Crear un lead en el CRM
   * Endpoint Core: POST /api/v1/bot/leads
   */
  async createLead(data: {
    title: string;
    description?: string;
    agentId?: string;
    source?: string;
    expectedValue?: number;
    priority?: string;
  }) {
    if (this.useMock) {
       return { success: true, leadId: 'mock-lead-id', message: 'Lead creado (MOCK)' };
    }

    try {
      const response = await this.client.post('/api/v1/bot/leads', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to create lead in Core', error);
      throw error;
    }
  }

  getDebugInfo() {
    return {
      useMock: this.useMock,
      baseURL: this.baseURL,
      envVars: {
        CORE_BACKEND_URL: process.env.CORE_BACKEND_URL || '(not set)',
        WHATSAPP_BOT_API_KEY: process.env.WHATSAPP_BOT_API_KEY
          ? `${process.env.WHATSAPP_BOT_API_KEY.slice(0, 6)}...` : '(not set)',
      },
    };
  }
}
