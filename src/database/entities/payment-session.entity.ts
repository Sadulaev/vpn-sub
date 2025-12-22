import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

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

  @Column({ type: 'text', nullable: true })
  vlessKey: string | null = null;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null = null;

  @Column({ type: 'timestamptz', nullable: true })
  keyExpiresAt: Date | null = null;

  @ManyToOne(() => User, (user) => user.paymentSessions, { nullable: true })
  @JoinColumn({ name: 'telegramId', referencedColumnName: 'telegramId' })
  user?: User;
}

