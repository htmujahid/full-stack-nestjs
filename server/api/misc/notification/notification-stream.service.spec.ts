import { Test, TestingModule } from '@nestjs/testing';
import { NotificationStreamService } from './notification-stream.service';

describe('NotificationStreamService', () => {
  let service: NotificationStreamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationStreamService],
    }).compile();

    service = module.get(NotificationStreamService);
  });

  describe('getOrCreateStream', () => {
    it('creates and returns a new subject when stream does not exist', () => {
      const sub = service.getOrCreateStream('user-1');

      expect(sub).toBeDefined();
      expect(typeof sub.next).toBe('function');
      expect(typeof sub.complete).toBe('function');
    });

    it('returns the same subject for the same userId', () => {
      const sub1 = service.getOrCreateStream('user-1');
      const sub2 = service.getOrCreateStream('user-1');

      expect(sub1).toBe(sub2);
    });

    it('returns different subjects for different userIds', () => {
      const sub1 = service.getOrCreateStream('user-1');
      const sub2 = service.getOrCreateStream('user-2');

      expect(sub1).not.toBe(sub2);
    });
  });

  describe('push', () => {
    it('emits data to the stream when it exists', (done) => {
      service.getOrCreateStream('user-1');
      const payload = { id: 'n1', type: 'alert', title: 'Test' };

      service.getOrCreateStream('user-1').subscribe({
        next: (ev) => {
          expect(ev.data).toEqual(payload);
          done();
        },
      });

      service.push('user-1', payload);
    });

    it('does nothing when stream does not exist', () => {
      expect(() => service.push('user-unknown', { foo: 'bar' })).not.toThrow();
    });
  });

  describe('pushToMany', () => {
    it('pushes to each user stream', (done) => {
      service.getOrCreateStream('u1');
      service.getOrCreateStream('u2');
      const payload = { id: 'n1', type: 'alert' };

      let received = 0;
      const check = () => {
        received++;
        if (received === 2) done();
      };

      service.getOrCreateStream('u1').subscribe({ next: check });
      service.getOrCreateStream('u2').subscribe({ next: check });

      service.pushToMany(['u1', 'u2'], payload);
    });

    it('does nothing when userIds is empty', () => {
      expect(() => service.pushToMany([], { foo: 'bar' })).not.toThrow();
    });
  });

  describe('disconnect', () => {
    it('completes and removes the stream', (done) => {
      service.getOrCreateStream('user-1');
      service.getOrCreateStream('user-1').subscribe({
        complete: () => done(),
      });

      service.disconnect('user-1');
    });

    it('creates a new stream after disconnect when getOrCreateStream is called again', () => {
      const sub1 = service.getOrCreateStream('user-1');
      service.disconnect('user-1');
      const sub2 = service.getOrCreateStream('user-1');

      expect(sub1).not.toBe(sub2);
    });

    it('does nothing when stream does not exist', () => {
      expect(() => service.disconnect('user-unknown')).not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('completes all subjects', (done) => {
      service.getOrCreateStream('u1');
      service.getOrCreateStream('u2');

      let completed = 0;
      const check = () => {
        completed++;
        if (completed === 2) done();
      };

      service.getOrCreateStream('u1').subscribe({ complete: check });
      service.getOrCreateStream('u2').subscribe({ complete: check });

      service.onModuleDestroy();
    });

    it('clears stream map so no further pushes work', () => {
      service.getOrCreateStream('user-1');
      service.onModuleDestroy();

      expect(() => service.push('user-1', { foo: 'bar' })).not.toThrow();
    });
  });
});
