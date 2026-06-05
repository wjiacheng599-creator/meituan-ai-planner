import { render, type RenderOptions } from '@testing-library/react';
import { type ReactElement } from 'react';
import userEvent from '@testing-library/user-event';

// 自定义 render 函数，包含常用 providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // 可以添加自定义选项
  initialRoute?: string;
}

export function customRender(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { initialRoute, ...renderOptions } = options;

  // 如果需要路由，可以在这里包装 Router
  // if (initialRoute) {
  //   window.history.pushState({}, 'Test page', initialRoute);
  // }

  return {
    user: userEvent.setup(),
    ...render(ui, renderOptions),
  };
}

// 重新导出所有 testing-library 工具
export * from '@testing-library/react';
export { customRender as render };
