import {
  AuthenticationService,
  FeatureService,
  MongooseAsyncFeatures,
  MongooseForFeatures
} from '@castcle-api/database';
import { CredentialDocument } from '@castcle-api/database/schemas';
import { CacheModule } from '@nestjs/common';
import { MongooseModule, MongooseModuleOptions } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { FeaturesController } from './features.controller';

let mongodMock: MongoMemoryServer;

const rootMongooseTestModule = (options: MongooseModuleOptions = {}) =>
  MongooseModule.forRootAsync({
    useFactory: async () => {
      mongodMock = await MongoMemoryServer.create();
      const mongoUri = mongodMock.getUri();
      return {
        uri: mongoUri,
        ...options
      };
    }
  });

const closeInMongodConnection = async () => {
  if (mongodMock) await mongodMock.stop();
};

describe('FeaturesController', () => {
  let appController: FeaturesController;
  let featureService: FeatureService;
  let userCredential: CredentialDocument;
  let authService: AuthenticationService;

  beforeAll(async () => {
    const app: TestingModule = await Test.createTestingModule({
      imports: [
        rootMongooseTestModule(),
        MongooseAsyncFeatures,
        MongooseForFeatures,
        CacheModule.register({
          store: 'memory',
          ttl: 1000
        })
      ],
      controllers: [FeaturesController],
      providers: [FeatureService, AuthenticationService]
    }).compile();

    appController = app.get<FeaturesController>(FeaturesController);
    featureService = app.get<FeatureService>(FeatureService);
    authService = app.get<AuthenticationService>(AuthenticationService);

    const resultAccount = await authService.createAccount({
      device: 'iPhone',
      deviceUUID: 'iphone12345',
      header: { platform: 'iphone' },
      languagesPreferences: ['th', 'th']
    });
    userCredential = resultAccount.credentialDocument;
  });

  afterAll(async () => {
    await closeInMongodConnection();
  });

  describe('getAllFeatures', () => {
    it('should get all feature in db', async () => {
      await featureService.create({
        slug: 'castcle',
        name: 'Castcle',
        key: 'hashtag.castcle'
      });
      const result = await appController.getAllFeature({
        $credential: userCredential
      } as any);
      const expectResult = {
        message: 'success',
        payload: [
          {
            id: '',
            slug: 'castcle',
            name: 'Castcle',
            key: 'hashtag.castcle'
          }
        ]
      };
      console.log(result);
      result.payload[0].id = '';
      expect(expectResult).toEqual(result);
    });
  });
});
