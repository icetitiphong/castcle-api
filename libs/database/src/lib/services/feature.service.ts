import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateFeature } from '../dtos/feature.dto';
import { FeatureDocument } from '../schemas/feature.schema';

@Injectable()
export class FeatureService {
  constructor(
    @InjectModel('Feature') public _featureModel: Model<FeatureDocument>
  ) {}

  /**
   * get all data from Feature Document
   *
   * @returns {FeatureDocument[]} return all Feature Document
   */
  async getAll() {
    console.log('get all feature');
    return this._featureModel.find().exec();
  }

  /**
   * create new hashtag
   * @param {CreateFeature} hashtag Create Hashtag payload
   * @returns {FeatureDocument} return new hashtag document
   */
  create = async (feature: CreateFeature) => {
    console.log('save feature');
    const newFeature = {
      ...feature
    };

    const createResult = await new this._featureModel(newFeature).save();
    return createResult;
  };
}
