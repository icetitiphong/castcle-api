/*
 * Copyright (c) 2021, Castcle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 3 only, as
 * published by the Free Software Foundation.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License
 * version 3 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 3 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Castcle, 22 Phet Kasem 47/2 Alley, Bang Khae, Bangkok,
 * Thailand 10160, or visit www.castcle.com if you need additional information
 * or have any questions.
 */
import { AuthenticationService, ContentService } from '@castcle-api/database';
import {
  Author,
  CastcleIncludes,
  ContentResponse,
  UpdateModelUserDto,
  UpdateUserDto
} from '@castcle-api/database/dtos';
import {
  ContentDocument,
  EngagementDocument,
  toSignedContentPayloadItem
} from '@castcle-api/database/schemas';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import {
  AVATAR_SIZE_CONFIGS,
  COMMON_SIZE_CONFIGS,
  Image
} from '@castcle-api/utils/aws';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    private authService: AuthenticationService,
    private contentService: ContentService
  ) {}
  private readonly logger = new CastLogger(AppService.name, CastLoggerOptions);

  getData(): { message: string } {
    return { message: 'Welcome to users!' };
  }

  /**
   * Upload any image in s3 and transform UpdateUserDto to UpdateModelUserDto
   * @param {UpdateUserDto} body
   * @param {CredentialRequest} req
   * @returns {UpdateModelUserDto}
   */
  async uploadUserInfo(
    body: UpdateUserDto,
    req: CredentialRequest
  ): Promise<UpdateModelUserDto> {
    let updateModelUserDto: UpdateModelUserDto = {};
    this.logger.debug(`uploading info avatar-${req.$credential.account._id}`);
    this.logger.debug(body);
    updateModelUserDto.images = {};
    if (body.images && body.images.avatar) {
      const avatar = await Image.upload(body.images.avatar as string, {
        filename: `avatar-${req.$credential.account._id}`,
        addTime: true,
        sizes: AVATAR_SIZE_CONFIGS,
        subpath: `account_${req.$credential.account._id}`
      });
      updateModelUserDto.images.avatar = avatar.image;
      this.logger.debug('after update', updateModelUserDto);
    }
    if (body.images && body.images.cover) {
      const cover = await Image.upload(body.images.cover as string, {
        filename: `cover-${req.$credential.account._id}`,
        addTime: true,
        sizes: COMMON_SIZE_CONFIGS,
        subpath: `account_${req.$credential.account._id}`
      });
      updateModelUserDto.images.cover = cover.image;
    }
    updateModelUserDto = { ...body, images: updateModelUserDto.images };
    return updateModelUserDto;
  }

  /**
   * return user document that has same castcleId but check if this request should have access to that user
   * @param {CredentialRequest} credentialRequest
   * @param {string} castcleId
   * @returns {UserDocument}
   */
  async getUserFromBody(
    credentialRequest: CredentialRequest,
    castcleId: string
  ) {
    const account = await this.authService.getAccountFromCredential(
      credentialRequest.$credential
    );
    const user = await this.authService.getUserFromCastcleId(castcleId);
    if (String(user.ownerAccount) !== String(account._id)) {
      throw new CastcleException(CastcleStatus.FORBIDDEN_REQUEST);
    }
    return user;
  }

  async getContentIfExist(id: string, req: CredentialRequest) {
    try {
      const content = await this.contentService.getContentFromId(id);
      if (content) return content;
      else
        throw new CastcleException(
          CastcleStatus.REQUEST_URL_NOT_FOUND,
          req.$language
        );
    } catch (e) {
      throw new CastcleException(
        CastcleStatus.REQUEST_URL_NOT_FOUND,
        req.$language
      );
    }
  }

  /**
   *
   * @param content
   * @param engagements
   * @returns {ContentResponse}
   */
  convertContentToContentResponse(
    content: ContentDocument,
    engagements: EngagementDocument[] = []
  ): ContentResponse {
    const users = [new Author(content.author).toIncludeUser()];
    const casts = content.originalPost
      ? [toSignedContentPayloadItem(content.originalPost)]
      : [];

    return {
      payload: content.toContentPayloadItem(engagements),
      includes: new CastcleIncludes({ users, casts })
    };
  }
}
