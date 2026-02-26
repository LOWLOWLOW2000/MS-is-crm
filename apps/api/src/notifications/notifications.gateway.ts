import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { CallingHelpRequest } from '../calling/entities/calling-help-request.entity';

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

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000'],
    credentials: true,
  },
})
export class NotificationsGateway {
  @WebSocketServer()
  private server!: Server;

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
}

