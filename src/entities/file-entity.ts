import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Workspace } from './workspace-entity';

@Entity('files')
export class File {
  @PrimaryGeneratedColumn()
  file_id: number;

  @ManyToOne(() => Workspace, (workspace) => workspace.files, {
    onDelete: 'CASCADE',
  })
  workspace: Workspace;

  @Column()
  filename: string;

  @Column()
  minio_path: string;

  @Column()
  mime_type: string;

  @Column('bigint')
  size: number;

  @Index()
  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @CreateDateColumn()
  uploaded_at: Date;
}
