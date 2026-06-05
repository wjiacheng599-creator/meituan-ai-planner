import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// 创建 MSW server 实例
export const server = setupServer(...handlers);
