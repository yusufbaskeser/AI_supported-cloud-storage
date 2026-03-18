import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from './user-entity';
import { File } from './file-entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn()
  workspace_id: number;

  @ManyToOne(() => User, (user) => user.workspaces, {
    onDelete: 'CASCADE',
  })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => File, (file) => file.workspace)
  files: File[];
}
