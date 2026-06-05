import { vi, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

/**
 * 等待元素出现
 */
export async function waitForElement(
  testId: string,
  options?: { timeout?: number }
): Promise<HTMLElement> {
  return waitFor(
    () => {
      const element = screen.getByTestId(testId);
      expect(element).toBeInTheDocument();
      return element;
    },
    { timeout: options?.timeout || 5000 }
  );
}

/**
 * 等待文本出现
 */
export async function waitForText(
  text: string,
  options?: { timeout?: number }
): Promise<HTMLElement> {
  return waitFor(
    () => {
      const element = screen.getByText(text);
      expect(element).toBeInTheDocument();
      return element;
    },
    { timeout: options?.timeout || 5000 }
  );
}

/**
 * 模拟延迟
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 创建 Mock 函数并设置返回值
 */
export function createMockFn<TArgs extends unknown[], TReturn>(
  returnValue: TReturn
): ReturnType<typeof vi.fn<TArgs, TReturn>> {
  return vi.fn<TArgs, TReturn>().mockReturnValue(returnValue);
}

/**
 * 创建异步 Mock 函数
 */
export function createAsyncMockFn<TArgs extends unknown[], TReturn>(
  returnValue: TReturn
): ReturnType<typeof vi.fn<TArgs, Promise<TReturn>>> {
  return vi.fn<TArgs, Promise<TReturn>>().mockResolvedValue(returnValue);
}

/**
 * 断言元素有特定属性
 */
export function expectElementToHaveAttribute(
  testId: string,
  attribute: string,
  value?: string
): void {
  const element = screen.getByTestId(testId);
  if (value !== undefined) {
    expect(element).toHaveAttribute(attribute, value);
  } else {
    expect(element).toHaveAttribute(attribute);
  }
}

/**
 * 断言元素可见
 */
export function expectElementToBeVisible(testId: string): void {
  const element = screen.getByTestId(testId);
  expect(element).toBeVisible();
}

/**
 * 断言元素不可见
 */
export function expectElementNotToBeVisible(testId: string): void {
  const element = screen.queryByTestId(testId);
  expect(element).not.toBeVisible();
}

/**
 * 生成测试用的随机ID
 */
export function generateTestId(): string {
  return `test_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 创建测试用的日期字符串
 */
export function createTestDate(daysFromNow: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

/**
 * Mock console 方法并收集输出
 */
export function mockConsole(): {
  logs: string[];
  warns: string[];
  errors: string[];
  restore: () => void;
} {
  const logs: string[] = [];
  const warns: string[] = [];
  const errors: string[] = [];

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.join(' '));
  };

  console.warn = (...args: unknown[]) => {
    warns.push(args.join(' '));
  };

  console.error = (...args: unknown[]) => {
    errors.push(args.join(' '));
  };

  return {
    logs,
    warns,
    errors,
    restore: () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

/**
 * 创建测试用的 fetch mock
 */
export function createFetchMock(responses: Record<string, unknown>): typeof fetch {
  return vi.fn().mockImplementation((url: string) => {
    const matchedResponse = Object.entries(responses).find(([pattern]) => url.includes(pattern));

    if (matchedResponse) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(matchedResponse[1]),
      });
    }

    return Promise.reject(new Error(`No mock for URL: ${url}`));
  });
}
