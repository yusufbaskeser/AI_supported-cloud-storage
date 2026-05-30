export class UserResponseDto {
  user_id: number;
  name: string;
  email: string;
  created_at: Date;
  storageLimit: number;
  usedStorage: number;
  profile_photo: string | null;
}
