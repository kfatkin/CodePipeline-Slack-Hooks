import { JiraLib } from '../jira/jira';
import { CHANNELS, USERS, SlackLib, SlackLibCommandForm } from '../slack/slack';
import { DynamoDbLib } from '../aws/dynamodb/dynamodb';

export interface Route {
  key: string;
  httpResponseMessage: string;
  lambda: string;
  metadata: any;
}

export class Router {
  static getRoutesFromSlackEvent(event) {
    if (event.type === 'url_validation') {
      return ROUTES.SLACK_URL_VALIDATION;
    }
    if (
      event &&
      SlackLib.fromGroup(event) &&
      event.channel === CHANNELS.BSS_DEVOPS_PLAYGROUND &&
      event.text === `<@${USERS.BssBot}> run busybox`
    ) {
      return ROUTES.PLAYGROUND_BUSYBOX_JOB;
    }
    if (event && event.text && JiraLib.hasTicket(event.text)) {
      return ROUTES.MESSAGE_WITH_JIRA_TICKET;
    }
    if (
      event &&
      event.channel === CHANNELS.NetSuite &&
      SlackLib.fromGroup(event) &&
      event.text === `<@${USERS.BssBot}> run netsuite`
    ) {
      return ROUTES.NET_SUITE_JOB;
    }
    if (SlackLib.fromBot(event)) {
      return ROUTES.FROM_BOT;
    }
    if (SlackLib.isAppMention(event)) {
      return ROUTES.APP_MENTION;
    }
    if (
      SlackLib.fromChannel(event) ||
      SlackLib.fromGroup(event) ||
      SlackLib.isUpdate(event)
    ) {
      return ROUTES.REGULAR_MESSAGE;
    }
    return ROUTES.UNKNOWN;
  }

  static getRoutesFromTrigger(event) {
    if (!event) {
      return ROUTES.UNKNOWN;
    }
    if (event.Records && event.Records.length <= 0) {
      return ROUTES.UNKNOWN;
    } else {
      const record = event.Records[0];
      if (Router.isCiCdApprovalRequest(record)) {
        return ROUTES.CICD_APPROVAL_REQUEST;
      } else if (Router.isSlackSendMessageRequest(record)) {
        return ROUTES.SLACK_SEND_MESSAGE_REQUEST;
      } else if (Router.isSsmSendCommandStatusRequest(record)) {
        return ROUTES.SSM_SEND_COMMAND_STATUS_REQUEST;
      } else {
        return ROUTES.UNKNOWN;
      }
    }
  }

  static async routesFromCommands(form: SlackLibCommandForm, region: string) {
    if (form.command !== '/bss') {
      return ROUTES.UNKNOWN;
    }
    try {
      const dynamoDb = new DynamoDbLib({
        tableName: 'BSS-DevOps-Slack-Hooks',
        region: region
      });
      const textInfo = form.text.split(/ +/).map(item => item.toLowerCase());
      const key = `${textInfo[0]} ${textInfo[1]}`;
      const route = await dynamoDb.getItemByKey(key);
      if (!route) {
        return ROUTES.UNKNOWN;
      } else if (Object.keys(route).length === 0) {
        return ROUTES.UNKNOWN;
      }
      return route;
    } catch (error) {
      return error;
    }
  }

  static getRoutesFromSlackActions(payload: string) {
    try {
      const interactive = JSON.parse(payload);
      if (interactive.type !== 'block_actions') {
        return ROUTES.UNKNOWN;
      }
      const action = interactive.actions[0];
      const value = JSON.parse(action.value);
      if (value.type === 'approval_response') {
        return ROUTES.CICD_APPROVAL_RESPONSE;
      }
      return ROUTES.UNKNOWN;
    } catch (error) {
      return ROUTES.UNKNOWN;
    }
  }

  static isCiCdApprovalRequest(record: any) {
    try {
      if (!record || !record.Sns || !record.Sns.Message) {
        return false;
      }
      if (record.EventSource !== 'aws:sns') {
        return false;
      }
      const message = JSON.parse(record.Sns.Message);
      if (message.approval) {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  static isSlackSendMessageRequest(record: any) {
    try {
      if (!record || !record.Sns || !record.Sns.Message) {
        return false;
      }
      if (record.EventSource !== 'aws:sns') {
        return false;
      }
      const message = JSON.parse(record.Sns.Message);
      if (message.slack && message.type === 'slack') {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  static isSsmSendCommandStatusRequest(record: any) {
    try {
      if (!record || !record.Sns || !record.Sns.Message) {
        return false;
      }
      if (record.EventSource !== 'aws:sns') {
        return false;
      }
      const message = JSON.parse(record.Sns.Message);
      if (message.type === 'ssm' && message.commandId) {
        return true;
      }
    } catch (error) {
      return false;
    }
  }
}
