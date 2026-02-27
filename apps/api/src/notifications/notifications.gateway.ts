import { OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CallingHelpRequest } from '../calling/entities/calling-help-request.entity';
import { CallingRecord } from '../calling/entities/calling-record.entity';

export interface HelpRequestedEvent {
  id: string;
  tenantId: string;
  requestedBy: string;
  companyName: string;
  scriptTab: string;
  requestedAt: string;
  queueNumber: number;
}

export interface DirectorJoinedEvent {
  requestId: string;
  tenantId: string;
  requestedBy: string;
  joinedBy: string;
  joinedAt: string;
}

export interface QueueUpdatedEvent {
  tenantId: string;
  requests: CallingHelpRequest[];
}

export interface CallEndedEvent {
  requestId: string;
  tenantId: string;
  resolvedAt: string;
}

export interface CallStartedEvent {
  tenantId: string;
  startedBy: string;
  companyName: string;
  meetingId: string;
  startedAt: string;
}

export interface RecallReminderEvent {
  tenantId: string;
  recordId: string;
  companyName: string;
  nextCallAt: string;
  reminderType: '5min' | '2min';
}

export interface ListDistributedEvent {
  tenantId: string;
  listId: string;
  listName: string;
  itemCount: number;
  distributedAt: string;
}

export interface ListAssignedEvent {
  tenantId: string;
  listId: string;
  listName: string;
  assigneeEmail: string;
  assignedBy: string;
  assignedAt: string;
}

export interface ListUnassignedEvent {
  tenantId: string;
  listId: string;
  listName: string;
  previousAssigneeEmail: string | null;
  unassignedBy: string;
  unassignedAt: string;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class NotificationsGateway implements OnModuleDestroy {
  @WebSocketServer()
  private server!: Server;
  private readonly reminderTimers = new Map<string, NodeJS.Timeout[]>();

  emitHelpRequested = (event: HelpRequestedEvent): void => {
    this.server.emit('call:help_requested', event);
  };

  emitDirectorJoined = (event: DirectorJoinedEvent): void => {
    this.server.emit('director:joined', event);
  };

  emitQueueUpdated = (event: QueueUpdatedEvent): void => {
    this.server.emit('queue:updated', event);
  };

  emitCallEnded = (event: CallEndedEvent): void => {
    this.server.emit('call:ended', event);
  };

  emitCallStarted = (event: CallStartedEvent): void => {
    this.server.emit('call:started', event);
  };

  emitRecallReminder = (event: RecallReminderEvent): void => {
    this.server.emit('recall:reminder', event);
  };

  emitListDistributed = (event: ListDistributedEvent): void => {
    this.server.emit('list:distributed', event);
  };

  emitListAssigned = (event: ListAssignedEvent): void => {
    this.server.emit('list:assigned', event);
  };

  emitListUnassigned = (event: ListUnassignedEvent): void => {
    this.server.emit('list:unassigned', event);
  };

  scheduleRecallReminders = (record: CallingRecord): void => {
    const key = record.id;
    const existing = this.reminderTimers.get(key);
    if (existing) {
      existing.forEach((timer) => clearTimeout(timer));
      this.reminderTimers.delete(key);
    }

    if (!record.nextCallAt) {
      return;
    }

    const nextCallMs = new Date(record.nextCallAt).getTime();
    if (Number.isNaN(nextCallMs)) {
      return;
    }

    const scheduleAt = (
      minutesBefore: number,
      reminderType: '5min' | '2min',
    ): NodeJS.Timeout | null => {
      const triggerAt = nextCallMs - minutesBefore * 60 * 1000;
      const delayMs = triggerAt - Date.now();
      if (delayMs <= 0) {
        return null;
      }

      return setTimeout(() => {
        this.emitRecallReminder({
          tenantId: record.tenantId,
          recordId: record.id,
          companyName: record.companyName,
          nextCallAt: record.nextCallAt ?? new Date(nextCallMs).toISOString(),
          reminderType,
        });
      }, delayMs);
    };

    const timers: NodeJS.Timeout[] = [];
    const timer5 = scheduleAt(5, '5min');
    const timer2 = scheduleAt(2, '2min');
    if (timer5) {
      timers.push(timer5);
    }
    if (timer2) {
      timers.push(timer2);
    }

    if (timers.length > 0) {
      this.reminderTimers.set(key, timers);
    }
  };

  onModuleDestroy = (): void => {
    this.reminderTimers.forEach((timers) => {
      timers.forEach((timer) => clearTimeout(timer));
    });
    this.reminderTimers.clear();
  };
}

