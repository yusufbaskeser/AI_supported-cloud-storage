import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class UserCacheInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    if (request.method !== 'GET') return next.handle();

    const cacheKey = `cache_user_${request.user?.user_id}_url_${request.url}`;

    try {
      const cached = await this.cacheManager.get(cacheKey);
      if (cached) return of(cached);
    } catch {}

    return next.handle().pipe(
      tap(async (data) => {
        try { await this.cacheManager.set(cacheKey, data, 90000); } catch {}
      }),
    );
  }
}
