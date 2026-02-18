import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { PaymentSession } from '@database/entities';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(PaymentSession)
    private readonly paymentRepository: Repository<PaymentSession>,
  ) {}

  /**
   * Добавить месяцы к текущей дате + 1 день запаса
   */
  private addMonthsPlusOneDay(months: number): Date {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    date.setDate(date.getDate() + 1);
    return date;
  }

  /**
   * Создать сессию платежа
   */
  async createSession(dto: CreatePaymentDto): Promise<PaymentSession> {
    const invId = Date.now().toString();

    const expiresAt = dto.ttlMinutes
      ? new Date(Date.now() + dto.ttlMinutes * 60_000)
      : null;

    const session = this.paymentRepository.create({
      invId,
      telegramId: dto.telegramId,
      period: dto.period,
      amount: dto.amount,
      status: 'pending',
      expiresAt,
    });

    const saved = await this.paymentRepository.save(session);
    this.logger.log(`Created payment session: ${saved.id} for user ${dto.telegramId}`);

    return saved;
  }

  /**
   * Пометить платёж как оплаченный
   */
  async markPaid(invId: string): Promise<PaymentSession | null> {
    const session = await this.paymentRepository.findOne({ where: { invId } });

    if (!session) {
      this.logger.warn(`Payment session not found: ${invId}`);
      return null;
    }

    // Идемпотентность: если уже оплачено — просто возвращаем
    if (session.status === 'paid') {
      this.logger.log(`Payment already processed: ${invId}`);
      return session;
    }

    session.status = 'paid';

    const saved = await this.paymentRepository.save(session);
    this.logger.log(`Payment marked as paid: ${invId}`);

    return saved;
  }

  /**
   * Найти платёж по invId
   */
  async findByInvId(invId: string): Promise<PaymentSession | null> {
    return this.paymentRepository.findOne({ where: { invId } });
  }

  /**
   * Очистить просроченные pending сессии
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.paymentRepository.update(
      {
        status: 'pending',
        expiresAt: LessThan(new Date()),
      },
      { status: 'expired' },
    );

    const affected = result.affected || 0;
    if (affected > 0) {
      this.logger.log(`Cleaned up ${affected} expired sessions`);
    }

    return affected;
  }
}

