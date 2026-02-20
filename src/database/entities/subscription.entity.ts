import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum SubscriptionSource {
  ADMIN = 'admin',
  BOT = 'bot',
}

@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_subscription_client')
  @Column({ type: 'uuid' })
  clientId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  telegramId: string | null = null;

  @Column({
    type: 'enum',
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @Column({
    type: 'enum',
    enum: SubscriptionSource,
    default: SubscriptionSource.ADMIN,
  })
  source!: SubscriptionSource;

  /** Примечание к подписке */
  @Column({ type: 'text', nullable: true })
  note: string | null = null;

  /** Период подписки в днях */
  @Column({ type: 'int' })
  days!: number;

  /** Лимит одновременных устройств */
  @Column({ type: 'int', default: 3 })
  deviceLimit!: number;

  @Column({ type: 'timestamptz' })
  startDate!: Date;

  @Column({ type: 'timestamptz' })
  endDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
