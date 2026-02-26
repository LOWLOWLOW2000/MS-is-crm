import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

export interface HelpRequestedEvent {
  id: string;
  tenantId: string;
  requestedBy: string;
  companyName: string;
  scriptTab: string;
  requestedAt: string;
  queueNumber: number;
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
}

