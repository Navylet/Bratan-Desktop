jest.mock('fs', () => ({
  promises: {
    access: jest.fn(() => Promise.resolve()),
    stat: jest.fn(() => Promise.resolve({ size: 1024 })),
  },
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

jest.mock('child_process', () => ({
  exec: (cmd, opts, callback) => {
    callback(null, { stdout: 'Страница 1\n\fСтраница 2', stderr: '' });
  },
}));

const { TaskQueue, HeavyTaskManager } = require('../../../taskManager');

describe('TaskQueue', () => {
  test('should execute tasks sequentially when maxConcurrent=1', async () => {
    const queue = new TaskQueue(1);
    const executionOrder = [];

    const p1 = queue.enqueue(async () => {
      executionOrder.push('task1-start');
      await new Promise((resolve) => setTimeout(resolve, 50));
      executionOrder.push('task1-end');
      return 'one';
    });

    const p2 = queue.enqueue(async () => {
      executionOrder.push('task2-start');
      await new Promise((resolve) => setTimeout(resolve, 10));
      executionOrder.push('task2-end');
      return 'two';
    });

    const results = await Promise.all([p1, p2]);

    expect(results).toEqual(['one', 'two']);
    expect(executionOrder).toEqual(['task1-start', 'task1-end', 'task2-start', 'task2-end']);
  });

  test('should produce stats correctly', () => {
    const queue = new TaskQueue(2);
    expect(queue.getStats()).toMatchObject({ pending: 0, running: 0, maxConcurrent: 2 });
  });
});

describe('HeavyTaskManager', () => {
  test('analyzePDF supports pages and ocr options', async () => {
    const manager = new HeavyTaskManager();
    const response = await manager.analyzePDF('/tmp/dummy.pdf', { pages: '1-1', ocr: true });

    expect(response).toHaveProperty('pageCount', 1);
    expect(response).toHaveProperty('ocrUsed', true);
    expect(response).toHaveProperty('lineCount');
    expect(response.pages.length).toBe(1);
  });
});
