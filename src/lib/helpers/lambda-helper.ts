import { Logger } from '../../logger';

export class LambdaHelper {
  static callback: Function;

  static success(data: any) {
    LambdaHelper.callback(null, {
      body: JSON.stringify(data),
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  static fail(data, statusCode?: number) {
    Logger.error(data);
    if (!statusCode) {
      statusCode = 502;
    }
    this.callback(null, {
      body: JSON.stringify(data),
      headers: { 'Access-Control-Allow-Origin': '*' },
      statusCode: statusCode
    });
  }
}
