import * as crypto from 'crypto';

export class Crypto {
  static hmac256(secretKey: string, data: string) {
    const hmac = crypto.createHmac('sha256', secretKey);
    const hashedData = hmac.update(data);
    const hexedData = hashedData.digest('hex');
    return hexedData;
  }
}
