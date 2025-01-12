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
  AuthenticationService,
  ContentService,
  HashtagService,
  MongooseAsyncFeatures,
  MongooseForFeatures,
  SocialProvider,
  SocialSyncService,
  UserService
} from '@castcle-api/database';
import {
  CastcleIncludes,
  ContentsResponse,
  ContentType,
  SaveContentDto,
  ShortPayload,
  SocialSyncDto,
  UpdateUserDto,
  UserResponseDto
} from '@castcle-api/database/dtos';
import { generateMockUsers, MockUserDetail } from '@castcle-api/database/mocks';
import {
  AccountDocument,
  ContentDocument,
  CredentialDocument,
  EngagementDocument,
  OtpObjective,
  UserDocument
} from '@castcle-api/database/schemas';
import { Configs } from '@castcle-api/environments';
import { CastcleException, CastcleStatus } from '@castcle-api/utils/exception';
import { TopicName, UserProducer } from '@castcle-api/utils/queue';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { UserController } from './app.controller';
import { AppService } from './app.service';
import { UserSettingsDto } from './dtos';

const fakeProcessor = jest.fn();
const fakeBull = BullModule.registerQueue({
  name: TopicName.Users,
  redis: {
    host: '0.0.0.0',
    port: 6380
  },
  processors: [fakeProcessor]
});
let mongod: MongoMemoryServer;
const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
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

describe('AppController', () => {
  let app: TestingModule;
  let appController: UserController;
  let service: UserService;
  let appService: AppService;
  let contentService: ContentService;
  let authService: AuthenticationService;
  let userCredential: CredentialDocument;
  let userAccount: AccountDocument;
  let socialSyncService: SocialSyncService;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        CacheModule.register({
          store: 'memory',
          ttl: 1000
        }),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        fakeBull
      ],
      controllers: [UserController],
      providers: [
        AppService,
        UserService,
        AuthenticationService,
        ContentService,
        UserProducer,
        HashtagService,
        SocialSyncService
      ]
    }).compile();
    service = app.get<UserService>(UserService);
    appService = app.get<AppService>(AppService);
    authService = app.get<AuthenticationService>(AuthenticationService);
    contentService = app.get<ContentService>(ContentService);
    socialSyncService = app.get<SocialSyncService>(SocialSyncService);
    const result = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th']
    });
    const accountActivation = await authService.signupByEmail(
      result.accountDocument,
      {
        email: 'test@gmail.com',
        displayId: 'test1234',
        displayName: 'test',
        password: '1234AbcD'
      }
    );
    userAccount = await authService.verifyAccount(accountActivation);
    userCredential = result.credentialDocument;
    jest
      .spyOn(appService, 'uploadUserInfo')
      .mockImplementation(async (body: UpdateUserDto, req: any) => {
        return {
          ...body,
          images: {
            avatar: Configs.DefaultAvatarImages,
            cover: Configs.DefaultAvatarCovers
          }
        };
      });
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });
  describe('getData', () => {
    it('should return "Welcome to users!"', () => {
      appController = app.get<UserController>(UserController);
      expect(appController.getData()).toEqual({ message: 'Welcome to users!' });
    });
  });

  describe('getMyData', () => {
    it('should return UserResponseDto of current credential', async () => {
      const response = await appController.getMyData({
        $credential: userCredential,
        $language: 'th'
      } as any);
      const user = await service.getUserFromCredential(userCredential);
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
      //appController.getMyData()
    });
  });

  describe('getUserById', () => {
    it('should return UserResponseDto of user id ', async () => {
      const user = await service.getUserFromCredential(userCredential);
      const response = (await appController.getUserById(
        { $credential: userCredential, $language: 'th' } as any,
        user._id
      )) as unknown as UserResponseDto;
      expect(response).toBeDefined();
      expect(response.castcleId).toEqual(user.displayId);
      expect(response.email).toEqual(userAccount.email);
    });
  });

  describe('updateMyData', () => {
    it('should update partial data from UpdateUserDto', async () => {
      const user = await service.getUserFromCredential(userCredential);
      expect((await user.toUserResponse()).dob).toBeNull();
      //check full response
      const updateDto = {
        dob: '1990-12-10',
        links: {
          facebook: 'http://facebook.com/abc',
          medium: 'https://medium.com/abc',
          website: 'https://djjam.app',
          youtube: 'https://youtube.com/abcdef'
        },
        images: {
          avatar: 'https://placehold.it/200x200',
          cover: 'https://placehold.it/1500x300'
        },
        overview: 'this is a test'
      } as UpdateUserDto;

      const responseFull = await appController.updateMyData(
        { $credential: userCredential, $language: 'th' } as any,
        updateDto
      );
      expect(responseFull.dob).toEqual(updateDto.dob);
      expect(responseFull.links).toEqual(updateDto.links);
      expect(responseFull.images).toBeDefined();
      expect(responseFull.overview).toEqual(updateDto.overview);
      const postReponse = await appController.getMyData({
        $credential: userCredential,
        $language: 'th'
      } as any);
      expect(postReponse).toEqual(responseFull);
    });
  });

  describe('- Contents related', () => {
    let user: UserDocument;
    let contentDtos: SaveContentDto[];
    const contents: ContentDocument[] = [];
    let expectedResponse: ContentsResponse;
    beforeAll(async () => {
      user = await service.getUserFromCredential(userCredential);
      contentDtos = [
        {
          type: ContentType.Short,
          payload: {
            message: 'hello'
          } as ShortPayload,
          castcleId: user.displayId
        },
        {
          type: ContentType.Short,
          payload: {
            message: 'hi'
          } as ShortPayload,
          castcleId: user.displayId
        }
      ];
      const engagementContents: EngagementDocument[][] = [];
      for (let i = 0; i < contentDtos.length; i++) {
        const newContent = await contentService.createContentFromUser(
          user,
          contentDtos[i]
        );
        engagementContents[i] = [
          await contentService.likeContent(newContent, user)
        ];
        contents.push(newContent);
      }
      expectedResponse = {
        payload: contents
          .sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1))
          .map((c, index) => c.toContentPayloadItem(engagementContents[index])),
        includes: new CastcleIncludes({
          users: contents.map(({ author }) => author)
        }),
        meta: {
          resultCount: contents.length,
          oldestId: contents[contents.length - 1].id,
          newestId: contents[0].id
        }
      };
      console.debug('liked stuff', JSON.stringify(expectedResponse));
    });
    describe('getMyContents', () => {
      it('should get all contents from current user credential', async () => {
        const response = await appController.getMyContents({
          $credential: userCredential,
          $language: 'th'
        } as any);
        //expect(response).toEqual(expectedResponse);
        expect(response.meta).toEqual(expectedResponse.meta);
      });
    });

    describe('getUserContents', () => {
      it('should get all contents from user id', async () => {
        const response = await appController.getUserContents(
          user._id,
          { $credential: userCredential, $language: 'th' } as any,
          { hasRelationshipExpansion: false }
        );
        expect(response.meta).toEqual(expectedResponse.meta);
      });
    });
  });

  describe('getMentions', () => {
    it('should get all mentions user form system', async () => {
      const response = await appController.getMentions(
        { $credential: userCredential } as any,
        '',
        1,
        5
      );
      expect(response.payload.length).toEqual(1);
      expect(response.payload[0].castcleId).toBeDefined();
      expect(response.payload[0].displayName).toBeDefined();
      expect(response.payload[0].followers).toBeDefined();
      expect(response.payload[0].following).toBeDefined();
    });
  });
  describe('getUserFollowing', () => {
    let mocks: MockUserDetail[];
    beforeAll(async () => {
      mocks = await generateMockUsers(5, 2, {
        accountService: authService,
        userService: service
      });

      const result = await appController.follow(
        mocks[0].user.displayId,
        {
          $credential: mocks[0].credential,
          $language: 'th'
        } as any,
        {
          targetCastcleId: mocks[1].user._id
        }
      );
    });
    it('should show all user following from the system', async () => {
      const followingResult = await appController.getUserFollowing(
        mocks[0].user.displayId,
        {
          $credential: mocks[0].credential,
          $language: 'th'
        } as any
      );
      expect(followingResult.payload.length).toEqual(1);
      console.log(followingResult);
      expect(followingResult.payload[0].castcleId).toEqual(
        mocks[1].user.displayId
      );
    });
  });
  describe('deleteMyData', () => {
    it('should remove user from User schema', async () => {
      await appController.deleteMyData(
        'email',
        {
          password: '1234AbcD'
        },
        {
          $credential: userCredential,
          $language: 'th'
        } as any
      );
      const user = await service.getUserFromCredential(userCredential);
      expect(user).toBeNull();
    });
  });

  describe('updateMobile', () => {
    let user: UserDocument;
    let account: AccountDocument;
    let credential;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService
      });

      user = mocksUsers[0].user;
      account = mocksUsers[0].account;
      credential = {
        $credential: mocksUsers[0].credential,
        $language: 'th'
      } as any;
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should update mobile successful', async () => {
      const countryCode = '+66';
      const mobile = '0815678900';
      const newOtp = await authService.generateOtp(
        account,
        OtpObjective.VerifyMobile,
        credential.$credential.account._id,
        'mobile',
        true
      );

      const request = {
        objective: OtpObjective.VerifyMobile,
        refCode: newOtp.refCode,
        countryCode: countryCode,
        mobileNumber: mobile
      };

      const result = await appController.updateMobile(credential, request);

      expect(result).toBeDefined;
      expect(result.verified.mobile).toEqual(true);
    });

    it('should return Exception when get dupplicate mobile number', async () => {
      const countryCode = '+66';
      const mobile = '0815678900';
      const newOtp = await authService.generateOtp(
        account,
        OtpObjective.VerifyMobile,
        credential.$credential.account._id,
        'mobile',
        false
      );

      const request = {
        objective: OtpObjective.VerifyMobile,
        refCode: newOtp.refCode,
        countryCode: countryCode,
        mobileNumber: mobile
      };

      await expect(
        appController.updateMobile(credential, request)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.MOBILE_NUMBER_IS_EXIST,
          credential.$language
        )
      );
    });

    it('should return Exception when get invalid ref code', async () => {
      const countryCode = '+66';
      const mobile = '0815678901';
      const newOtp = await authService.generateOtp(
        account,
        OtpObjective.VerifyMobile,
        credential.$credential.account._id,
        'mobile',
        false
      );

      const request = {
        objective: OtpObjective.VerifyMobile,
        refCode: newOtp.refCode,
        countryCode: countryCode,
        mobileNumber: mobile
      };

      await expect(
        appController.updateMobile(credential, request)
      ).rejects.toEqual(new CastcleException(CastcleStatus.INVLAID_REFCODE));
    });

    it('should return Exception when get guest account', async () => {
      const countryCode = '+66';
      const mobile = '0815678901';
      const guest = await authService.createAccount({
        device: 'iPhone8+',
        deviceUUID: 'ios8abc',
        header: { platform: 'ios' },
        languagesPreferences: ['th'],
        geolocation: {
          countryCode: '+66',
          continentCode: '+66'
        }
      });

      const newOtp = await authService.generateOtp(
        guest.accountDocument,
        OtpObjective.VerifyMobile,
        guest.accountDocument._id,
        'mobile',
        true
      );

      const request = {
        objective: OtpObjective.VerifyMobile,
        refCode: newOtp.refCode,
        countryCode: countryCode,
        mobileNumber: mobile
      };

      const credentialGuest = {
        $credential: guest.credentialDocument,
        $language: 'th'
      } as any;

      await expect(
        appController.updateMobile(credentialGuest, request)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.FORBIDDEN_REQUEST,
          credential.$language
        )
      );
    });

    it('should return exception when wrong objective', async () => {
      const countryCode = '+66';
      const mobile = '0815678900';

      const request = {
        objective: OtpObjective.ForgotPassword,
        refCode: '12345678',
        countryCode: countryCode,
        mobileNumber: mobile
      };

      await expect(
        appController.updateMobile(credential, request)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_TYPE_MISMATCH,
          credential.$language
        )
      );
    });
  });

  describe('syncSocial', () => {
    let user: UserDocument;
    let credential;
    let defaultRequest: SocialSyncDto;
    beforeAll(async () => {
      const mocksUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService
      });

      user = mocksUsers[0].user;
      credential = {
        $credential: mocksUsers[0].credential,
        $language: 'th'
      } as any;

      defaultRequest = {
        castcleId: user.displayId,
        provider: SocialProvider.Twitter,
        uid: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true
      };
    });

    afterAll(async () => {
      await service._userModel.deleteMany({});
    });

    it('should create sync social successful', async () => {
      await appController.syncSocial(credential, defaultRequest);
      const userSync = await socialSyncService.getSocialSyncByUser(user);

      expect(userSync.length).toEqual(1);
      expect(userSync[0].provider).toEqual(SocialProvider.Twitter);
    });

    it('should return Exception when get guest account', async () => {
      const guest = await authService.createAccount({
        device: 'iPhone8+',
        deviceUUID: 'ios8abc',
        header: { platform: 'ios' },
        languagesPreferences: ['th'],
        geolocation: {
          countryCode: '+66',
          continentCode: '+66'
        }
      });

      const credentialGuest = {
        $credential: guest.credentialDocument,
        $language: 'th'
      } as any;

      await expect(
        appController.syncSocial(credentialGuest, defaultRequest)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.FORBIDDEN_REQUEST,
          credential.$language
        )
      );
    });

    it('should return exception when get duplicate socail sync', async () => {
      await expect(
        appController.syncSocial(credential, defaultRequest)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.SOCIAL_PROVIDER_IS_EXIST,
          credential.$language
        )
      );

      const mocksNewUsers = await generateMockUsers(1, 0, {
        userService: service,
        accountService: authService
      });

      const newUser = mocksNewUsers[0].user;
      const newCredential = {
        $credential: mocksNewUsers[0].credential,
        $language: 'th'
      } as any;

      const newRequest: SocialSyncDto = {
        castcleId: newUser.displayId,
        provider: SocialProvider.Twitter,
        uid: 't12345678',
        userName: 'mocktw',
        displayName: 'mock tw',
        avatar: 'www.twitter.com/mocktw',
        active: true
      };
      await expect(
        appController.syncSocial(newCredential, newRequest)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.SOCIAL_PROVIDER_IS_EXIST,
          credential.$language
        )
      );
    });

    it('should get all sync social from user', async () => {
      const request = {
        castcleId: user.displayId,
        provider: SocialProvider.Facebook,
        uid: 'f89766',
        userName: 'mockfb',
        displayName: 'mock fb',
        avatar: 'www.facebook.com/mockfb',
        active: true
      };
      await appController.syncSocial(credential, request);
      const result = await appController.getSyncSocial(credential);
      const expectResult = {
        twitter: {
          uid: 't12345678',
          username: 'mocktw',
          displayName: 'mock tw',
          avatar: 'www.twitter.com/mocktw',
          active: true
        },
        facebook: {
          uid: 'f89766',
          username: 'mockfb',
          displayName: 'mock fb',
          avatar: 'www.facebook.com/mockfb',
          active: true
        },
        youtube: null,
        medium: null
      };
      expect(result).toBeDefined();
      expect(result).toEqual(expectResult);
    });

    it('should update sync social successful', async () => {
      const request = {
        castcleId: user.displayId,
        provider: SocialProvider.Facebook,
        uid: '56738393',
        userName: 'mockfb2',
        displayName: 'mock fb2',
        avatar: 'www.facebook.com/mockfb2',
        active: true
      };
      await appController.updateSyncSocial(credential, request);
      const userSync = await socialSyncService.getSocialSyncByUser(user);
      const result = userSync.find((x) => x.provider === request.provider);
      expect(result.socialId).toEqual(request.uid);
      expect(result.userName).toEqual(request.userName);
      expect(result.displayName).toEqual(request.displayName);
      expect(result.avatar).toEqual(request.avatar);
    });

    it('should delete sync social successful', async () => {
      const request = {
        castcleId: user.displayId,
        provider: SocialProvider.Facebook,
        uid: '56738393'
      };
      await appController.deleteSyncSocial(credential, request);
      const userSync = await socialSyncService.getSocialSyncByUser(user);
      const result = userSync.find((x) => x.provider === request.provider);
      expect(result).toBeUndefined();
    });
  });

  describe('updateUserSettings', () => {
    it('should update perferred language from Account schema', async () => {
      const credentialGuest = {
        $credential: userCredential,
        $language: 'th'
      } as any;

      const req: UserSettingsDto = {
        preferredLanguages: ['th', 'en']
      };
      await appController.updateUserSettings(credentialGuest, req);
      const account = await authService.getAccountFromCredential(
        userCredential
      );
      expect(account.preferences.langagues).toEqual(['th', 'en']);
    });

    it('should return Exception when empty language', async () => {
      const credentialGuest = {
        $credential: userCredential,
        $language: 'en'
      } as any;

      const req: UserSettingsDto = {
        preferredLanguages: []
      };

      await expect(
        appController.updateUserSettings(credentialGuest, req)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.PAYLOAD_TYPE_MISMATCH,
          credentialGuest.$language
        )
      );
    });

    it('should return Exception when get guest account', async () => {
      const guest = await authService.createAccount({
        device: 'iPhone8+',
        deviceUUID: 'ios8abc',
        header: { platform: 'ios' },
        languagesPreferences: ['th'],
        geolocation: {
          countryCode: '+66',
          continentCode: '+66'
        }
      });

      const credentialGuest = {
        $credential: guest.credentialDocument,
        $language: 'en'
      } as any;

      const req: UserSettingsDto = {
        preferredLanguages: ['th', 'en']
      };

      await expect(
        appController.updateUserSettings(credentialGuest, req)
      ).rejects.toEqual(
        new CastcleException(
          CastcleStatus.FORBIDDEN_REQUEST,
          credentialGuest.$language
        )
      );
    });
  });
});
