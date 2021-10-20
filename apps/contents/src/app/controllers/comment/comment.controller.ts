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

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req
} from '@nestjs/common';
import {
  AuthenticationService,
  UserService,
  ContentService
} from '@castcle-api/database';
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { DEFAULT_QUERY_OPTIONS } from '@castcle-api/database/dtos';
import { CredentialRequest } from '@castcle-api/utils/interceptors';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { ApiBody } from '@nestjs/swagger';
import { LimitPipe, PagePipe, SortByPipe } from '@castcle-api/utils/pipes';
import { CaslAbilityFactory, Action } from '@castcle-api/casl';
import {
  CreateCommentBody,
  EditCommentBody,
  LikeCommentBody,
  ReplyCommentBody
} from '../../dtos/comment.dto';
import { CacheKeyName } from '@castcle-api/utils/cache';
import {
  CastcleController,
  CastcleAuth,
  CastcleBasicAuth
} from '@castcle-api/utils/decorators';

@CastcleController('1.0')
@Controller()
export class CommentController {
  constructor(
    private authService: AuthenticationService,
    private userService: UserService,
    private contentService: ContentService,
    private caslAbility: CaslAbilityFactory
  ) {}
  private readonly logger = new CastLogger(
    CommentController.name,
    CastLoggerOptions
  );

  //TO BE REMOVED !!! this should be check at interceptor or guards
  async _getContentIfExist(id: string, req: CredentialRequest) {
    const content = await this.contentService.getContentFromId(id);
    if (content) return content;
    else
      throw new CastcleException(
        CastcleStatus.REQUEST_URL_NOT_FOUND,
        req.$language
      );
  }

  @ApiBody({
    type: CreateCommentBody
  })
  @CastcleBasicAuth()
  @Post('contents/:id/comments')
  async createComment(
    @Param('id') contentId: string,
    @Body() commentBody: CreateCommentBody,
    @Req() req: CredentialRequest
  ) {
    const content = await this._getContentIfExist(contentId, req);
    const user = await this.authService.getUserFromCastcleId(
      commentBody.castcleId
    );
    const comment = await this.contentService.createCommentForContent(
      user,
      content,
      {
        message: commentBody.message
      }
    );
    return {
      payload: await comment.toCommentPayload(this.contentService._commentModel)
    };
  }

  @CastcleAuth(CacheKeyName.Comments)
  @Get('contents/:id/comments')
  async getAllComment(
    @Param('id') contentId: string,
    @Req() req: CredentialRequest,
    @Query('sortBy', SortByPipe)
    sortByOption: {
      field: string;
      type: 'desc' | 'asc';
    } = DEFAULT_QUERY_OPTIONS.sortBy,
    @Query('page', PagePipe)
    pageOption: number = DEFAULT_QUERY_OPTIONS.page,
    @Query('limit', LimitPipe)
    limitOption: number = DEFAULT_QUERY_OPTIONS.limit
  ) {
    const content = await this._getContentIfExist(contentId, req);
    const comments = await this.contentService.getCommentsFromContent(content, {
      limit: limitOption,
      page: pageOption,
      sortBy: sortByOption
    });
    return {
      payload: comments.items,
      pagination: comments.pagination
    };
  }

  @ApiBody({
    type: ReplyCommentBody
  })
  @CastcleBasicAuth()
  @Post('contents/:id/comments/:commentId/reply')
  async replyComment(
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Body() replyCommentBody: ReplyCommentBody,
    @Req() req: CredentialRequest
  ) {
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.authService.getUserFromCastcleId(
      replyCommentBody.castcleId
    );
    const replyComment = await this.contentService.replyComment(user, comment, {
      message: replyCommentBody.message
    });
    return {
      payload: await replyComment.toCommentPayload(
        this.contentService._commentModel
      )
    };
  }

  @ApiBody({
    type: EditCommentBody
  })
  @CastcleBasicAuth()
  @Put('contents/:id/comments/:commentId')
  async updateComment(
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Body() editCommentBody: EditCommentBody,
    @Req() req: CredentialRequest
  ) {
    //const content = await this._getContentIfExist(contentId, req);
    const comment = await this.contentService.getCommentById(commentId);
    const updatedComment = await this.contentService.updateComment(comment, {
      message: editCommentBody.message
    });
    return {
      payload: await updatedComment.toCommentPayload(
        this.contentService._commentModel
      )
    };
  }

  @HttpCode(204)
  @CastcleBasicAuth()
  @Delete('contents/:id/comments/:commentId')
  async deleteComment(
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Req() req: CredentialRequest
  ) {
    //const content = await this._getContentIfExist(contentId, req);
    const comment = await this.contentService.getCommentById(commentId);
    const deleteResult = await this.contentService.deleteComment(comment);
    return '';
  }

  @ApiBody({
    type: LikeCommentBody
  })
  @HttpCode(204)
  @CastcleBasicAuth()
  @Put('contents/:id/comments/:commentId/liked')
  async likeComment(
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Body() likeCommentBody: LikeCommentBody,
    @Req() req: CredentialRequest
  ) {
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.authService.getUserFromCastcleId(
      likeCommentBody.castcleId
    );
    await this.contentService.likeComment(user, comment);
    return '';
  }

  @ApiBody({
    type: LikeCommentBody
  })
  @CastcleBasicAuth()
  @HttpCode(204)
  @Put('contents/:id/comments/:commentId/unliked')
  async unlikeComment(
    @Param('id') contentId: string,
    @Param('commentId') commentId: string,
    @Body() likeCommentBody: LikeCommentBody,
    @Req() req: CredentialRequest
  ) {
    const comment = await this.contentService.getCommentById(commentId);
    const user = await this.authService.getUserFromCastcleId(
      likeCommentBody.castcleId
    );
    await this.contentService.unlikeComment(user, comment);
    return '';
  }
}