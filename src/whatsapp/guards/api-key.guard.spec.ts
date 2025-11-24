import { ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;

  beforeEach(() => {
    guard = new ApiKeyGuard();
  });

  function mockContextWithApiKey(key: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-api-key': key },
        }),
      }),
    } as any;
  }

  it('should allow access with correct API key', () => {
    const context = mockContextWithApiKey('my-secret-api-key');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access with incorrect API key', () => {
    const context = mockContextWithApiKey('wrong-key');
    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access if API key is missing', () => {
    const context = mockContextWithApiKey(undefined as any);
    expect(guard.canActivate(context)).toBe(false);
  });
});
