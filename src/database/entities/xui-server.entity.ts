import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ServerPool } from './server-pool.entity';

export enum XuiServerStatus {
  ACTIVE = 'active',
  FAILED = 'failed',
  DISABLED = 'disabled',
}

@Entity('xui_servers')
export class XuiServer {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Читаемое имя сервера, например "Germany-1" */
  @Column({ type: 'varchar', length: 255 })
  name!: string;

  // ─── Подключение к панели 3x-ui ───

  /** Базовый URL панели, например "https://1.2.3.4:2053" */
  @Column({ type: 'varchar', length: 500 })
  apiUrl!: string;

  /** Web base path панели, например "dashboard" → /dashboard/panel/api/... */
  @Column({ type: 'varchar', length: 255, default: '' })
  webBasePath: string = '';

  /** Логин от панели 3x-ui */
  @Column({ type: 'varchar', length: 255 })
  username!: string;

  /** Пароль от панели 3x-ui */
  @Column({ type: 'varchar', length: 255 })
  password!: string;

  /** ID инбаунда, в который добавляются клиенты */
  @Column({ type: 'int', nullable: true })
  inboundId: number | null = null;

  // ─── Параметры для построения VLESS-ссылки ───

  /** Публичный хост для VLESS-ссылки */
  @Column({ type: 'varchar', length: 255 })
  publicHost!: string;

  /** Публичный порт для VLESS-ссылки */
  @Column({ type: 'int', default: 443 })
  publicPort: number = 443;

  /** Тип безопасности: reality, tls и т.д. */
  @Column({ type: 'varchar', length: 50, default: 'reality' })
  security: string = 'reality';

  /** Public key (для reality) */
  @Column({ type: 'varchar', length: 255, default: '' })
  pbk: string = '';

  /** Fingerprint */
  @Column({ type: 'varchar', length: 50, default: 'chrome' })
  fp: string = 'chrome';

  /** SNI */
  @Column({ type: 'varchar', length: 255, default: '' })
  sni: string = '';

  /** Short ID */
  @Column({ type: 'varchar', length: 100, default: '' })
  sid: string = '';

  /** Spider X */
  @Column({ type: 'varchar', length: 255, default: '/' })
  spx: string = '/';

  /** flow (например xtls-rprx-vision) */
  @Column({ type: 'varchar', length: 100, default: '' })
  flow: string = '';

  // ─── Статус и связи ───

  @Column({
    type: 'enum',
    enum: XuiServerStatus,
    default: XuiServerStatus.ACTIVE,
  })
  status!: XuiServerStatus;

  /** Лимит пользователей (для информации, не жёсткий) */
  @Column({ type: 'int', default: 100 })
  usersLimit: number = 100;

  @Index('idx_xui_server_pool')
  @Column({ type: 'int', nullable: true })
  serverPoolId: number | null = null;

  @ManyToOne(() => ServerPool, (pool) => pool.servers, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serverPoolId' })
  serverPool!: ServerPool;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
