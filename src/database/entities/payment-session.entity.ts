import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

@Entity('payment_sessions')
@Index('idx_payment_status', ['status'])
@Index('idx_payment_expires_at', ['expiresAt'])
@Index('idx_payment_telegram_id', ['telegramId'])
export class PaymentSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'bigint', unique: true })
  invId!: string;

  @Column({ type: 'bigint' })
  telegramId!: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: PaymentStatus;

  @Column({ type: 'int' })
  period!: number;

  @Column({ type: 'int' })
  amount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null = null;
}

