import type { CallingHelpRequest } from '../../calling/entities/calling-help-request.entity';

export interface DirectorOverviewDto {
  helpRequests: (CallingHelpRequest & { requestedByName?: string })[];
  waitingCount: number;
  waitingQueue: CallingHelpRequest[];
}
