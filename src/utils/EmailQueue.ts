import { QueueItem, EmailData } from '../types';
import { generateUUID } from './UUID';

export class EmailQueue {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private processor?: (item: QueueItem) => Promise<void>;

  enqueue(email: EmailData, priority: number = 0): string {
    const id = generateUUID();
    const item: QueueItem = {
      id,
      email,
      priority,
      createdAt: new Date(),
      retryCount: 0
    };

    this.insertWithPriority(item);
    return id;
  }

  private insertWithPriority(item: QueueItem): void {
    // Insert based on priority (higher priority = lower index)
    let insertIndex = 0;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].priority < item.priority) {
        insertIndex = i + 1;
      } else {
        break;
      }
    }
    this.queue.splice(insertIndex, 0, item);
  }

  dequeue(): QueueItem | undefined {
    return this.queue.shift();
  }

  peek(): QueueItem | undefined {
    return this.queue[0];
  }

  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      return true;
    }
    return false;
  }

  getSize(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  clear(): void {
    this.queue = [];
  }

  startProcessing(processor: (item: QueueItem) => Promise<void>): void {
    if (this.processing) {
      throw new Error('Queue is already processing');
    }

    this.processing = true;
    this.processor = processor;
    this.processNext();
  }

  stopProcessing(): void {
    this.processing = false;
  }

  private async processNext(): Promise<void> {
    if (!this.processing || !this.processor) {
      return;
    }

    const item = this.dequeue();
    if (!item) {
      // Queue is empty, wait a bit and try again
      const timer = setTimeout(() => this.processNext(), 1000);
      timer.unref(); // Prevent timer from keeping process alive
      return;
    }

    try {
      await this.processor(item);
    } catch (error) {
      // Re-queue with increased retry count if needed
      if (item.retryCount < 3) {
        item.retryCount++;
        this.insertWithPriority(item);
      }
      console.error(`Failed to process email ${item.id}:`, error);
    }

    // Process next item with a small delay to prevent blocking
    const timer = setTimeout(() => this.processNext(), 10);
    timer.unref(); // Prevent timer from keeping process alive
  }

  getItems(): QueueItem[] {
    return [...this.queue];
  }

  getItemById(id: string): QueueItem | undefined {
    return this.queue.find(item => item.id === id);
  }

  updatePriority(id: string, newPriority: number): boolean {
    const item = this.getItemById(id);
    if (!item) {
      return false;
    }

    this.remove(id);
    item.priority = newPriority;
    this.insertWithPriority(item);
    return true;
  }
} 