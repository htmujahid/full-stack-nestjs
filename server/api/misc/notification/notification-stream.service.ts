import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';

/**
 * Per-user SSE stream registry. Production pattern: single-instance uses in-memory
 * Subject map; multi-instance would use Redis Pub/Sub (subscribe to notification:user:{userId}).
 */
@Injectable()
export class NotificationStreamService implements OnModuleDestroy {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  getOrCreateStream(userId: string): Subject<MessageEvent> {
    let sub = this.streams.get(userId);
    if (!sub) {
      sub = new Subject<MessageEvent>();
      this.streams.set(userId, sub);
    }
    return sub;
  }

  push(userId: string, data: MessageEvent['data']): void {
    const sub = this.streams.get(userId);
    if (sub) sub.next({ data });
  }

  pushToMany(userIds: string[], data: MessageEvent['data']): void {
    for (const uid of userIds) this.push(uid, data);
  }

  disconnect(userId: string): void {
    const sub = this.streams.get(userId);
    if (sub) {
      sub.complete();
      this.streams.delete(userId);
    }
  }

  onModuleDestroy() {
    for (const sub of this.streams.values()) sub.complete();
    this.streams.clear();
  }
}
