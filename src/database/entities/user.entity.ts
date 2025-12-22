import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PaymentSession } from './payment-session.entity';

@Entity('users')
export class User {
  @PrimaryColumn({ type: 'bigint' })
  telegramId!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  firstName: string | null = null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string | null = null;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean = false;

  @Column({ type: 'boolean', default: true })
  isActive: boolean = true;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => PaymentSession, (session) => session.user)
  paymentSessions!: PaymentSession[];
}

