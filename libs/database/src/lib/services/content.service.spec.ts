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

import { Test, TestingModule } from '@nestjs/testing';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { AuthenticationService } from './authentication.service';
import { UserService } from './user.service';
import { ContentService } from './content.service';
import { env } from '../environment';
import { AccountDocument } from '../schemas/account.schema';
import { CredentialDocument } from '../schemas/credential.schema';
import { MongooseForFeatures, MongooseAsyncFeatures } from '../database.module';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ContentDocument, ContentSchema } from '../schemas/content.schema';
import { SaveContentDto, ContentType } from '../dtos';
import { UserDocument } from '../schemas';
import { ShortPayload } from '../dtos/content.dto';
import { EngagementDocument } from '../schemas/engagement.schema';

let mongod: MongoMemoryServer;
const rootMongooseTestModule = (
  options: MongooseModuleOptions = { useFindAndModify: false }
) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongod = await MongoMemoryServer.create();
      const mongoUri = mongod.getUri();
      return {
        uri: mongoUri,
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongod) await mongod.stop();
};

describe('ContentService', () => {
  let service: ContentService;
  let userService: UserService;
  let authService: AuthenticationService;
  let user: UserDocument;
  console.log('test in real db = ', env.db_test_in_db);
  const importModules = env.db_test_in_db
    ? [
        MongooseModule.forRoot(env.db_uri, env.db_options),
        MongooseAsyncFeatures,
        MongooseForFeatures
      ]
    : [rootMongooseTestModule(), MongooseAsyncFeatures, MongooseForFeatures];
  const providers = [ContentService, UserService, AuthenticationService];
  let result: {
    accountDocument: AccountDocument;
    credentialDocument: CredentialDocument;
  };
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: importModules,
      providers: providers
    }).compile();
    service = module.get<ContentService>(ContentService);
    userService = module.get<UserService>(UserService);
    authService = module.get<AuthenticationService>(AuthenticationService);
    result = await authService.createAccount({
      deviceUUID: 'test12354',
      languagesPreferences: ['th', 'th'],
      header: {
        platform: 'ios'
      },
      device: 'ifong'
    });
    //sign up to create actual account
    await authService.signupByEmail(result.accountDocument, {
      displayId: 'sp',
      displayName: 'sp002',
      email: 'sompop.kulapalanont@gmail.com',
      password: 'test1234567'
    });
    user = await userService.getUserFromCredential(result.credentialDocument);
  });
  afterAll(async () => {
    if (env.db_test_in_db) await closeInMongodConnection();
  });
  describe('#createContentFromUser', () => {
    it('should create short content instance in db with author as user', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload
      });
      expect((content.payload as ShortPayload).message).toEqual(
        shortPayload.message
      );
      expect(content.type).toEqual(ContentType.Short);
      expect(content.author.id).toEqual(user._id);
      expect(content.revisionCount).toEqual(1);
    });
  });
  describe('#updateContentFromId()', () => {
    it('should update from saveDTO with content id', async () => {
      const shortPayload: ShortPayload = {
        message: 'this is test status'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload
      });
      const revisionCount = content.revisionCount;
      expect(content.revisionCount).toEqual(1);
      const updatePayload: ShortPayload = {
        message: 'this is test status2',
        link: [
          {
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=yuPjoC3jmPA'
          }
        ]
      };
      const result = await service.updateContentFromId(content._id, {
        type: ContentType.Short,
        payload: updatePayload
      });
      expect((result.payload as ShortPayload).message).toEqual(
        updatePayload.message
      );

      expect((result.payload as ShortPayload).link).toEqual(updatePayload.link);
      const postContent = await service.getContentFromId(content._id);
      expect((postContent.payload as ShortPayload).message).toEqual(
        updatePayload.message
      );
      expect((postContent.payload as ShortPayload).link).toEqual(
        updatePayload.link
      );
      const revisions = await service.getContentRevisions(postContent);
      expect(postContent.revisionCount).toEqual(revisions.length);
    });
  });
  describe('#getContentsFromUser()', () => {
    it('should return ContentDocument[] from author', async () => {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
      const shortPayload1: ShortPayload = {
        message: 'Order 1'
      };
      const content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload1
      });
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 100);
      });
      const shortPayload2: ShortPayload = {
        message: 'Order 2'
      };
      const content2 = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2
      });
      const contents = await service.getContentsFromUser(user);
      expect(contents.items[0].payload).toEqual(shortPayload2);
      expect(contents.items[1].payload).toEqual(shortPayload1);
      const contentsInverse = await service.getContentsFromUser(user, {
        sortBy: {
          field: 'updateAt',
          type: 'asc'
        }
      });
      expect(
        contentsInverse.items[contentsInverse.items.length - 2].payload
      ).toEqual(shortPayload1);
      expect(
        contentsInverse.items[contentsInverse.items.length - 1].payload
      ).toEqual(shortPayload2);
    });
  });
  describe('#likeContent()', () => {
    let content: ContentDocument;
    beforeAll(async () => {
      const shortPayload2: ShortPayload = {
        message: 'Test Like 2'
      };
      content = await service.createContentFromUser(user, {
        type: ContentType.Short,
        payload: shortPayload2
      });
    });
    it('should update total like Count after call', async () => {
      const likeResult = await service.likeContent(content, user);
      expect(likeResult).toBeDefined();
      const engagement = await service._engagementModel
        .findById(likeResult._id)
        .exec();
      console.log('newly engagement', engagement);
      expect(engagement.user).toEqual(user._id);
      const postContent = await service.getContentFromId(content._id);
      console.log(postContent.engagements);
      expect(postContent.engagements['like']).toBeDefined();
      expect(postContent.engagements['like'].count).toEqual(1);
    });
    it('should if have double like should have the same amount of like', async () => {
      const likeResult = await service.likeContent(content, user);
      const postContent = await service.getContentFromId(content._id);
      expect(postContent.engagements['like']).toBeDefined();
      expect(postContent.engagements['like'].count).toEqual(1);
    });
    describe('#unLikeContent()', () => {
      it('should update total like after call', async () => {
        await service.unLikeContent(content, user);
        const postContent = await service.getContentFromId(content._id);
        expect(postContent.engagements['like']).toBeDefined();
        expect(postContent.engagements['like'].count).toEqual(0);
      });
      it('should handle double unlike', async () => {
        await service.unLikeContent(content, user);
        const postContent = await service.getContentFromId(content._id);
        expect(postContent.engagements['like']).toBeDefined();
        expect(postContent.engagements['like'].count).toEqual(0);
      });
    });
  });
  describe('#recastContent/#quoteContent', () => {
    const users: UserDocument[] = [];
    const userInfo = [
      {
        accountRequirement: {
          device: 'iphone',
          deviceUUID: 'iphone1234',
          header: {
            platform: 'iOs'
          },
          languagesPreferences: ['th', 'th']
        },
        signupRequirement: {
          displayId: 'npop',
          displayName: 'npop',
          email: 'sompop.k@gmail.com',
          password: '123456789'
        }
      },
      {
        accountRequirement: {
          device: 'iphone',
          deviceUUID: 'iphone5678',
          header: {
            platform: 'iOs'
          },
          languagesPreferences: ['th', 'th']
        },
        signupRequirement: {
          displayId: 'sompop',
          displayName: 'sompop',
          email: 'sompop.ku@gmail.com',
          password: '123456789'
        }
      },
      {
        accountRequirement: {
          device: 'iphone',
          deviceUUID: 'iphone1234',
          header: {
            platform: 'iOs'
          },
          languagesPreferences: ['th', 'th']
        },
        signupRequirement: {
          displayId: 'kuku',
          displayName: 'kuku',
          email: 'sompop.kuku@gmail.com',
          password: '123456789789'
        }
      }
    ];
    let contentA: ContentDocument;
    beforeAll(async () => {
      //create user  create content
      for (let i = 0; i < userInfo.length; i++) {
        const createAccResult = await authService.createAccount(
          userInfo[i].accountRequirement
        );
        const accountActivation = await authService.signupByEmail(
          createAccResult.accountDocument,
          userInfo[i].signupRequirement
        );
        users[i] = await userService.getUserFromCredential(
          createAccResult.credentialDocument
        );
      }
      //userA create a content
      contentA = await service.createContentFromUser(users[0], {
        payload: {
          message: 'hello world'
        } as ShortPayload,
        type: ContentType.Short
      });
    });
    describe('#recastContentFromUser()', () => {
      let contentB: ContentDocument;
      let engagementB: EngagementDocument;
      let contentC: ContentDocument;
      let engagementC: EngagementDocument;
      beforeAll(async () => {
        //recast a content
        const resultB = await service.recastContentFromUser(contentA, users[1]);
        contentB = resultB.recastContent;
        engagementB = resultB.engagement;
        const resultC = await service.recastContentFromUser(contentB, users[2]);
        contentC = resultC.recastContent;
        engagementC = resultC.engagement;
      });
      it('should create new content type as recast', () => {
        expect(contentB.type).toEqual(ContentType.Recast);
        expect(contentC.type).toEqual(ContentType.Recast);
      });
      it('should update engagement recast at original content', async () => {
        const postContentA = await service.getContentFromId(contentA._id);
        expect(postContentA.engagements.recast.count).toEqual(2);
        const postContentB = await service.getContentFromId(contentB._id);
        expect(postContentB.engagements.recast.count).toEqual(0);
      });
      it('when we delete recast content it should delete engagemnt of original content', async () => {
        await service.deleteContentFromId(contentC._id);
        const postContentA = await service.getContentFromId(contentA._id);

        expect(postContentA.engagements.recast.count).toEqual(1);
      });
    });
    describe('#quoteContentFromUser()', () => {
      let contentB: ContentDocument;
      let engagementB: EngagementDocument;
      let contentC: ContentDocument;
      let engagementC: EngagementDocument;
      beforeAll(async () => {
        //recast a content
        const resultB = await service.recastContentFromUser(contentA, users[1]);
        contentB = resultB.recastContent;
        engagementB = resultB.engagement;
        const resultC = await service.quoteContentFromUser(
          contentB,
          users[2],
          'this is good content'
        );
        contentC = resultC.quoteContent;
        engagementC = resultC.engagement;
      });
      it('should create new content type as recast', async () => {
        const postContentA = await service.getContentFromId(contentA._id);
        expect(postContentA.engagements.quote.count).toEqual(1);
      });
      it('when we delete recast content it should delete enagement of original content', async () => {
        await service.deleteContentFromId(contentC._id);
        const postContentA = await service.getContentFromId(contentA._id);
        expect(postContentA.engagements.quote.count).toEqual(0);
      });
    });
    describe('Comment Features', () => {
      beforeAll(async () => {
        console.log('before comment features');
      });
      describe('#createCommentForContent()', () => {
        it('should be create a document in comment collection', async () => {
          console.log('create Comment for content');
        });
      });
    });
  });
});
