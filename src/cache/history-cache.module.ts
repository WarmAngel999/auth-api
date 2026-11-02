import { Module } from '@nestjs/common';
import { HistoryCache } from './history-cache.service';

@Module({
  providers: [HistoryCache],
  exports: [HistoryCache],
})
export class HistoryCacheModule {}
