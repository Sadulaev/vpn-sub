import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { XuiServer } from './xui-server.entity';

@Entity('server_pools')
export class ServerPool {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  name!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null = null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean = true;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @OneToMany(() => XuiServer, (server: XuiServer) => server.serverPool)
  servers!: XuiServer[];
}
