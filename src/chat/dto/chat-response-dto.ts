export class ChatResponseDto {
  reply: string;
  files?: Array<{
    file_id: number;
    filename: string;
    tags?: string[];
    mime_type?: string;
    size?: number;
    uploaded_at?: Date;
  }>;
  stats?: any;
  action: 'search_files' | 'stats' | 'general' | 'generate_link' | 'delete_files' | 'delete_workspace' | 'rename_file';
  toast?: string;
  workspace_id?: number;
  workspace_name?: string;
}
