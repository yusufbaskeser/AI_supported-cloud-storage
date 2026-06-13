import { Client } from 'minio';

export function createMinioClient(): Client {
  const endpoint = process.env.MINIO_ENDPOINT!;
  const useSSL = !endpoint.startsWith('http://');
  const port = useSSL ? 443 : 9000;

  return new Client({
    endPoint: endpoint.replace(/https?:\/\//, ''),
    port,
    useSSL,
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    region: 'auto',
  });
}
