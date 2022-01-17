import { FeatureService } from '@castcle-api/database';
import { CreateFeature, FeatureResponse } from '@castcle-api/database/dtos';

import { Configs } from '@castcle-api/environments';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CredentialInterceptor,
  CredentialRequest,
  HttpCacheSharedInterceptor
} from '@castcle-api/utils/interceptors';
import {
  Body,
  CacheKey,
  CacheTTL,
  Controller,
  Get,
  Post,
  Req,
  UseInterceptors
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse } from '@nestjs/swagger';

@ApiHeader({
  name: Configs.RequiredHeaders.AcceptLanguague.name,
  description: Configs.RequiredHeaders.AcceptLanguague.description,
  example: Configs.RequiredHeaders.AcceptLanguague.example,
  required: true
})
@ApiHeader({
  name: Configs.RequiredHeaders.AcceptVersion.name,
  description: Configs.RequiredHeaders.AcceptVersion.description,
  example: Configs.RequiredHeaders.AcceptVersion.example,
  required: true
})
@Controller({
  version: '1.0'
})
@Controller()
export class FeaturesController {
  constructor(private featureService: FeatureService) {}
  private readonly logger = new CastLogger(
    FeaturesController.name,
    CastLoggerOptions
  );

  @ApiBearerAuth()
  @ApiOkResponse({
    type: FeatureResponse
  })
  @UseInterceptors(HttpCacheSharedInterceptor)
  @CacheKey(CacheKeyName.HashtagsGet.Name)
  @CacheTTL(CacheKeyName.HashtagsGet.Ttl)
  @UseInterceptors(CredentialInterceptor)
  @Get('features')
  async getAllFeature(@Req() req: CredentialRequest): Promise<FeatureResponse> {
    this.logger.log('Start get all feature');
    const result = await this.featureService.getAll();
    this.logger.log('Success get all feature');
    return {
      message: 'success',
      payload: result.map((feature) => feature.toFeaturePayload())
    };
  }

  @Post('features')
  async create(@Body() createFeature: CreateFeature) {
    return await this.featureService.create(createFeature);
  }
}
