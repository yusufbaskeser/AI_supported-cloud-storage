import { NestFactory } from '@nestjs/core';
import { ValidationPipe, RequestMethod, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const REQUIRED_ENV = [
    'DATABASE_URL',
    'JWT_SECRET',
    'MINIO_ENDPOINT',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
    'MINIO_BUCKET',
    'GEMINI_API_KEY',
  ];
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length)
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
