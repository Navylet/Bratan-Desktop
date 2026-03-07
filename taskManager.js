// Менеджер очередей задач для предотвращения зависаний
const EventEmitter = require('events');

class TaskQueue extends EventEmitter {
  constructor(maxConcurrent = 3) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.queue = [];
    this.running = 0;
    this.taskId = 0;
  }

  // Добавить задачу
  enqueue(taskFn, description = 'Task', priority = 0) {
    const id = ++this.taskId;
    const task = {
      id,
      fn: taskFn,
      description,
      priority,
      status: 'pending',
      createdAt: new Date(),
      result: null,
      error: null
    };

    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority); // higher priority first
    this.emit('taskAdded', task);
    this.process();
    return id;
  }

  // Обработка очереди
  process() {
    while (this.running < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this.running++;
      task.status = 'running';
      this.emit('taskStarted', task);

      Promise.resolve()
        .then(() => task.fn())
        .then(result => {
          task.status = 'completed';
          task.result = result;
          this.emit('taskCompleted', task);
        })
        .catch(error => {
          task.status = 'failed';
          task.error = error;
          this.emit('taskFailed', task);
        })
        .finally(() => {
          this.running--;
          this.process();
        });
    }
  }

  // Получить статус задачи
  getTask(id) {
    const allTasks = [...this.queue].concat(this.getRunningTasks());
    return allTasks.find(t => t.id === id);
  }

  // Получить выполняемые задачи
  getRunningTasks() {
    // В реальном приложении здесь был бы отслеживаемый список
    return [];
  }

  // Получить статистику
  getStats() {
    return {
      totalTasks: this.taskId,
      pending: this.queue.length,
      running: this.running,
      maxConcurrent: this.maxConcurrent
    };
  }
}

// Менеджер ресурсоёмких операций (анализ PDF, поиск, etc.)
class HeavyTaskManager {
  constructor() {
    this.pdfQueue = new TaskQueue(1); // PDF analysis — последовательно
    this.webQueue = new TaskQueue(2); // Веб-запросы — параллельно
    this.aiQueue = new TaskQueue(1); // AI inference — последовательно
  }

  // Анализ PDF (через pdftotext или OCR)
  async analyzePDF(pdfPath, options = {}) {
    const { pages = 'all', ocr = false } = options;
    return this.pdfQueue.enqueue(async () => {
      const { spawn } = require('child_process');
      const fs = require('fs').promises;
      const { promisify } = require('util');
      const exec = promisify(require('child_process').exec);

      if (!fs.access(pdfPath).then(() => true).catch(() => false)) {
        throw new Error(`PDF файл не найден: ${pdfPath}`);
      }

      // Используем pdftotext
      const cmd = `pdftotext "${pdfPath}" -`;
      const { stdout, stderr } = await exec(cmd, { maxBuffer: 50 * 1024 * 1024 }); // 50MB буфер

      if (stderr && !stderr.includes('Warning')) {
        console.warn('pdftotext stderr:', stderr);
      }

      const text = stdout.toString();
      const lines = text.split('\n').filter(l => l.trim());
      
      // Базовая структура: страницы, абзацы
      const pages = text.split('\f').map((pageText, idx) => ({
        page: idx + 1,
        content: pageText.trim(),
        paragraphs: pageText.split('\n\n').filter(p => p.trim())
      }));

      return {
        path: pdfPath,
        size: (await fs.stat(pdfPath)).size,
        pageCount: pages.length,
        totalCharacters: text.length,
        pages: pages.filter(p => p.content),
        rawText: text.substring(0, 50000), // первые 50k символов
        fullTextAvailable: text.length <= 50000
      };
    }, `Анализ PDF: ${path.basename(pdfPath)}`, 5);
  }

  // Поиск в Google (через Perplexity API или прямое)
  async webSearch(query, options = {}) {
    const { maxResults = 10, source = 'perplexity' } = options;
    return this.webQueue.enqueue(async () => {
      // Используем Perplexity API (уже есть в OpenClaw)
      const axios = require('axios');
      const apiKey = process.env.PERPLEXITY_API_KEY;
      
      if (!apiKey) {
        throw new Error('Perplexity API ключ не настроен');
      }

      const response = await axios.post('https://api.perplexity.ai/chat/completions', {
        model: 'sonar',
        messages: [{ role: 'user', content: query }],
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        query,
        answer: response.data.choices[0].message.content,
        sources: response.data.choices[0].sources || [],
        model: response.data.model
      };
    }, `Web поиск: ${query.substring(0, 50)}`, 3);
  }

  // AI-анализ текста (через OpenClaw или прямо к модели)
  async aiAnalysis(text, instruction, options = {}) {
    const { model = 'deepseek-reasoner', maxTokens = 4000 } = options;
    return this.aiQueue.enqueue(async () => {
      // В реальном приложении здесь вызов OpenClaw API или прямой запрос к модели
      // Пока имитация
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        instruction,
        model,
        summary: `Анализ выполнен моделью ${model}. Текст длиной ${text.length} символов.`,
        insights: [
          'Ключевые темы выделены',
          'Рекомендации сгенерированы',
          'Структура определена'
        ],
        processedAt: new Date().toISOString()
      };
    }, `AI анализ: ${instruction.substring(0, 50)}`, 7);
  }

  // Получить статус всех очередей
  getStatus() {
    return {
      pdfQueue: this.pdfQueue.getStats(),
      webQueue: this.webQueue.getStats(),
      aiQueue: this.aiQueue.getStats(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { TaskQueue, HeavyTaskManager };