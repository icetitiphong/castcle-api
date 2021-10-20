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

import { ApiProperty } from '@nestjs/swagger';
import { CastcleQueryOptions, Pagination } from './common.dto';

export enum NotificationType {
  Content = 'content',
  Comment = 'comment',
  System = 'system'
}

export enum NotificationSource {
  Profile = 'profile',
  Page = 'page',
  System = 'system'
}

class ObjectRef {
  @ApiProperty()
  id: string;
}

export class NotificationPayloadDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  avatar: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  content?: ObjectRef;

  @ApiProperty()
  comment?: ObjectRef;

  @ApiProperty()
  system?: ObjectRef;

  @ApiProperty()
  read: boolean;
}

export class NotificationResponse {
  @ApiProperty({ type: NotificationPayloadDto, isArray: true })
  payload: NotificationPayloadDto[];

  @ApiProperty()
  pagination: Pagination;
}

export class NotificationQueryOptions extends CastcleQueryOptions {
  source?: NotificationSource;
}

export const DEFAULT_NOTIFICATION_QUERY_OPTIONS = {
  sortBy: {
    field: 'updatedAt',
    type: 'desc'
  },
  source: NotificationSource.Profile,
  page: 1,
  limit: 25
} as NotificationQueryOptions;

export interface CreateNotification {
  avatar: string;
  message: string;
  source: NotificationSource;
  sourceUserId: {
    _id: string;
  };
  type: NotificationType;
  targetRef: {
    _id: string;
  };
  read: boolean;
  credential: {
    _id: string;
  };
}

export class RegisterTokenDto {
  @ApiProperty()
  deviceUUID: string;

  @ApiProperty()
  firebaseToken: string;
}

export class NotificationBadgesPayloadDto {
  @ApiProperty()
  badges: string;
}
export class NotificationBadgesResponse {
  @ApiProperty({ type: NotificationBadgesPayloadDto, isArray: false })
  payload: NotificationBadgesPayloadDto;
}