import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Workspace } from './workspace-entity';
import { Chat } from './chat-entity';

export enum UserRole {
  USER = 'user',
  VIEWER_ADMIN = 'viewer',
  EDITOR_ADMIN = 'editor',
  SUPER_ADMIN = 'super',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  user_id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn()
  created_at: Date;

  @Column({ default: false })
  is_verified: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  verification_code: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  verification_code_expires: Date | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  resetPasswordToken: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  resetPasswordExpires: Date | null;

  @Column({ type: 'bigint', default: 5368709120 })
  storageLimit: number;

  @Column({ type: 'bigint', default: 0 })
  usedStorage: number;

  @Column({ type: 'text', nullable: true, default: null })
  profile_photo: string | null;

  @OneToMany(() => Workspace, (workspace) => workspace.user)
  workspaces: Workspace[];

  @OneToMany(() => Chat, (chat) => chat.user)
  chats: Chat[];
}