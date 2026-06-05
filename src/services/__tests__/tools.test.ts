import { describe, expect, it, vi } from 'vitest';
import { executeToolByName } from '../tools';

describe('executeToolByName', () => {
  it('reuses a successful non-idempotent reservation result', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const args = {
      name: `幂等测试餐厅_${Date.now()}`,
      time: '18:00',
      people: 2,
      contact: '138****8888',
    };

    const first = await executeToolByName('make_reservation', args);
    const second = await executeToolByName('make_reservation', args);

    expect(first.success).toBe(true);
    expect(second).toEqual(first);
  });
});
