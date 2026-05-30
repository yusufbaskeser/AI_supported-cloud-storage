export class FileResponseDto {
  file_id: number;
  filename: string;
  minio_path: string;
  mime_type: string;
  size: number;
  tags: string[];
  uploaded_at: Date;
  workspace?: {
    workspace_id: number;
    name: string;
  };
}
