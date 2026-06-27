import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns OK', () => {
    const controller = new HealthController();

    expect(controller.check()).toBe('OK');
  });
});
