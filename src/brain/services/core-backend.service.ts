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

  constructor() {
    const baseURL = process.env.CORE_BACKEND_URL;
    const apiKey = process.env.WHATSAPP_BOT_API_KEY; // Cambiado de CORE_BACKEND_API_KEY

    // Determinar si usar mock
    this.useMock =
      !baseURL ||
      !apiKey ||
      apiKey === 'development-key-temp-mock';

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
    category: 'plumbing' | 'electric' | 'heating' | 'cleaning' | 'security' | 'other';
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
      const response = await this.client.post('/api/v1/bot/auth/validate-identity', {
        dni,
        whatsappJid: jid,
      });
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
      const response = await this.client.post('/api/showings', data);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to schedule showing', error);
      throw error;
    }
  }
}
