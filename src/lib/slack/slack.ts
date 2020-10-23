import * as Slack from 'slack';
import { Crypto } from '../helpers/crypto';

export interface SlackLibCommandForm {
  text: string;
  command: string;
  response_url: string;
  trigger_id: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  team_id: string;
  team_domain: string;
}

export const CHANNELS = {
  BSS_DEVOPS_PLAYGROUND: 'GKBPB3H5W',
  CLOUD_OPS_TEAM: 'GCSE6FH97',
  NetSuite: 'GKM5U2XU4',
  BSS_DEV_DEPLOYMENTS: 'GKWJVQ7M4'
};

export const USERS = {
  BssBot: 'UKBFRLR9T'
};

export interface SlackLibConfig {
  token: string;
}

export interface MessageOptions {
  channel: string;
  ts?: string;
}

export class SlackLib {
  private config: SlackLibConfig;
  private username = 'bss';

  constructor(config: SlackLibConfig) {
    this.config = config;
  }

  static getSignature(secret: string, payload: string, headers: any) {
    const timeStamp = headers['X-Slack-Request-Timestamp'];
    const requestPayload = `v0:${timeStamp}:${payload}`;
    return Crypto.hmac256(secret, requestPayload);
  }

  static isValidRequest(secret: string, payload: string, headers: any) {
    const requestSignature = SlackLib.getSignature(secret, payload, headers);
    const signature = headers['X-Slack-Signature'];
    return signature === `v0=${requestSignature}`;
  }

  static fromPlayground(event: any) {
    if (event && event.channel === CHANNELS.BSS_DEVOPS_PLAYGROUND) {
      return true;
    }
    return false;
  }

  static fromBot(event: any) {
    if (event && event.subtype === 'bot_message') {
      return true;
    }
    return false;
  }

  static isAppMention(event: any) {
    if (event && event.type === 'app_mention') {
      return true;
    }
    return false;
  }

  static fromGroup(event: any) {
    if (event && event.client_msg_id && event.channel_type === 'group') {
      return true;
    }
    return false;
  }

  static fromChannel(event: any) {
    if (event && event.client_msg_id && event.channel_type === 'channel') {
      return true;
    }
    return false;
  }

  static isUpdate(event: any) {
    if (event && event.subtype && event.subtype === 'message_changed') {
      return true;
    }
    return false;
  }

  async update(text: string, option: MessageOptions, blocks?: any[]) {
    const message: any = {
      channel: option.channel,
      text: text,
      username: this.username,
      ts: option.ts,
      token: this.config.token
    };
    if (blocks) {
      message.blocks = blocks;
    }
    return await Slack.chat.update(message);
  }

  async message(text: string, option: MessageOptions, blocks?: any[]) {
    const message: any = {
      channel: option.channel,
      text: text,
      username: this.username,
      token: this.config.token
    };
    if (blocks) {
      message.blocks = blocks;
    }
    return await Slack.chat.postMessage(message);
  }
}
