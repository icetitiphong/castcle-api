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
import { CastLogger, CastLoggerOptions } from '@castcle-api/logger';
import { NotificationMessage, TopicName } from '@castcle-api/utils/queue';
import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Job } from 'bull';
import { FirebaseAdmin, InjectFirebaseAdmin } from 'nestjs-firebase';

@Injectable()
@Processor(TopicName.Notifications)
export class NotificationConsumer {
  constructor(
    @InjectFirebaseAdmin() private readonly firebase: FirebaseAdmin
  ) {}

  private readonly logger = new CastLogger(
    NotificationConsumer.name,
    CastLoggerOptions
  );

  /**
   * consume notofication message from queue
   * @param {NotificationMessage} NotificationMessage notofication message
   * @returns {}
   */
  @Process()
  readOperationJob(job: Job<{ notification: NotificationMessage }>) {
    const deviceToken =
      'cjC1mBtCvqs:APA91bHXVsaOOk-FEcSHQXQzli5v_LV-0QVRaIXePqnTcaXWmSHUeCMwBDE2K0CGrb6b-8oech7z_xiyCn1BezgX1clWDqjWgQQBav1DFibdEAyuq6GSe6N_4c3-3EUR2--P9ysEAjB3';

    const message = {
      notification: {
        title: 'Price drop',
        body: job.data.notification.message
      },
      token: job.data.notification.firebaseToken
    };

    this.firebase.messaging.send(message);
    this.logger.log(
      `consume message '${JSON.stringify(job.data.notification)}}' `
    );
  }
}
