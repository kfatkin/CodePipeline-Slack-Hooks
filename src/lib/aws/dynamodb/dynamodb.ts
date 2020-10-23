import { DynamoDB } from 'aws-sdk';
import { promisify } from 'util';
import { GetItemInput, Converter } from 'aws-sdk/clients/dynamodb';

export interface DynamoDbConfig {
  tableName: string;
  region: string;
}

export class DynamoDbLib {
  private config: DynamoDbConfig;
  private dbHandler: DynamoDB;

  constructor(config: DynamoDbConfig) {
    this.config = config;
    this.dbHandler = new DynamoDB({ region: this.config.region });
  }

  async getItemByKey(key: string) {
    const param: GetItemInput = {
      Key: { key: { S: key } },
      TableName: this.config.tableName
    };
    const getItem = promisify(this.dbHandler.getItem.bind(this.dbHandler));
    const response = await getItem(param);
    if (response && Object.keys(response).length) {
      const item = response.Item;
      const convert: any = {};
      for (const key of Object.keys(item)) {
        convert[key] = Converter.output(item[key]);
      }
      return convert;
    }
    return null;
  }
}
