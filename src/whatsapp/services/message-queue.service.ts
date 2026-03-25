import { Injectable, Logger } from '@nestjs/common';

export type MessagePriority = 'HIGH' | 'NORMAL';

interface InternalJob {
  id: string;
  priority: MessagePriority;
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

/**
 * Cola de mensajes con dos prioridades para envíos de WhatsApp.
 *
 * HIGH  → respuestas directas de soporte/AI. Sin pre-delay de cola;
 *         la humanización (typing indicator) actúa como delay natural.
 * NORMAL → notificaciones proactivas/bulk. Pre-delay de 15-30s entre
 *          mensajes para evitar comportamiento de spam.
 *
 * La cola puede pausarse ante un posible baneo y reanudarse manualmente.
 */
@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly highQueue: InternalJob[] = [];
  private readonly normalQueue: InternalJob[] = [];
  private isProcessing = false;
  private isPaused = false;
  private jobCounter = 0;

  get sizes() {
    return { high: this.highQueue.length, normal: this.normalQueue.length };
  }

  get paused() {
    return this.isPaused;
  }

  /**
   * Pausar todos los envíos (ej: detección de baneo).
   * Los jobs ya encolados se retienen y se procesan al llamar resume().
   */
  pause(reason?: string): void {
    this.isPaused = true;
    this.logger.warn(`[Queue] Pausada${reason ? ': ' + reason : ''}`);
  }

  resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.logger.log('[Queue] Reanudada');
    this.processNext();
  }

  /**
   * Encolar un job. Devuelve una Promise que se resuelve cuando el
   * job fue efectivamente ejecutado (el mensaje fue enviado).
   *
   * Para notificaciones bulk (NORMAL), considerar usar sendBulkText en
   * WhatsappService que NO espera la resolución (fire-and-forget).
   */
  enqueue(execute: () => Promise<any>, priority: MessagePriority = 'HIGH'): Promise<any> {
    return new Promise((resolve, reject) => {
      const job: InternalJob = {
        id: `msg-${++this.jobCounter}`,
        priority,
        execute,
        resolve,
        reject,
      };

      if (priority === 'HIGH') {
        this.highQueue.push(job);
      } else {
        this.normalQueue.push(job);
      }

      this.logger.debug(
        `[Queue] Job ${job.id} encolado (${priority}). Sizes: high=${this.highQueue.length} normal=${this.normalQueue.length}`,
      );

      this.processNext();
    });
  }

  private processNext(): void {
    if (this.isProcessing || this.isPaused) return;

    const job = this.highQueue.shift() ?? this.normalQueue.shift();
    if (!job) return;

    this.isProcessing = true;
    void this.runJob(job);
  }

  private async runJob(job: InternalJob): Promise<void> {
    // Pre-delay solo para mensajes NORMAL (notificaciones proactivas/bulk).
    // Los HIGH no tienen pre-delay: la humanización interna es suficiente.
    if (job.priority === 'NORMAL') {
      const preDelay = this.randomBetween(15_000, 30_000);
      this.logger.debug(`[Queue] Job ${job.id} (NORMAL): esperando ${preDelay}ms antes de enviar`);
      await this.sleep(preDelay);
    }

    try {
      const result = await job.execute();
      job.resolve(result);
    } catch (error) {
      this.logger.error(`[Queue] Job ${job.id} falló: ${error.message}`);
      job.reject(error);
    } finally {
      this.isProcessing = false;
      this.processNext();
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
