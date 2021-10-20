import { Environment } from '@castcle-api/environments';
import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { Downloader } from './downloader';
import { Image } from './image';
import { Uploader, UploadOptions } from './uploader';
import { AVARTAR_SIZE_CONFIGS, COMMON_SIZE_CONFIGS } from '../config';

@Module({
  imports: [
    HttpModule.register({
      timeout: Environment.http_time_out
    })
  ],
  controllers: [],
  providers: [Downloader],
  exports: [HttpModule, Downloader]
})
export class UtilsAwsModule {}

export {
  Image,
  Uploader,
  UploadOptions,
  Downloader,
  AVARTAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS
};