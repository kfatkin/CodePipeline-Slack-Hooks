/**
 * Created by Ethan Dave Gomez
 * Version: 1.0.0
 */

import {
  LambdaHandler,
  Lambda,
  Context,
  Callback,
  Event,
  PostConstructor
} from 'lambda-phi';
import {
  Path,
  QueryParams,
  StageVariables,
  Body,
  Any
} from 'lambda-phi/lib/api-gateway';

import { Logger } from './logger';
import { Strings } from './lib/helpers/strings';
import { SlackLib } from './lib/slack/slack';
import { JiraLib } from './lib/jira/jira';
import { NetSuite } from './lib/netsuite/netsuite';
import { Router, Route } from './lib/router/router';
import { LambdaHelper } from './lib/helpers/lambda-helper';
import { CiCd } from './lib/cicd/cicd';
import { LambdaLib } from './lib/aws/lambda';
import { SsmLib } from './lib/aws/ssm';

@Lambda()
class MainApp {
  @Context() context;

  @Event() event;

  @Body() body;

  @Callback() callback;

  @QueryParams() queryParams;

  @StageVariables() stage: any;

  private objBody: any;
  private slack: SlackLib;
  private region: string = process.env.AWS_REGION;

  @PostConstructor()
  postConstructor() {
    LambdaHelper.callback = this.callback.bind(this);
  }

  // @Path('/operations/hooks/slack/test/')
  // async processSlackHookTest() {
  //   const ssm = new SsmLib({ region: this.region });
  //   const sig = await ssm.getParameter('/BSS/DevOps/Slack/SigningSecret', true);
  //   Logger.info(new Date());
  //   Logger.info(Crypto.hmac256('test', 'adf'));
  //   Logger.info(new Date());
  // }

  @Path('/operations/hooks/slack')
  @Any()
  async processSlackHooks() {
    try {
      this.parseJsonBody();
      if (this.isSlackRequest()) {
        await this.validateRequest();
        this.slack = await this.getSlack();
        switch (+Router.getRoutesFromSlackEvent(this.objBody.event)) {
          case ROUTES.SLACK_URL_VALIDATION:
            LambdaHelper.success(this.objBody.challenge);
            break;
          case ROUTES.MESSAGE_WITH_JIRA_TICKET:
            new JiraLib(this.objBody.event, this.slack);
            break;
          case ROUTES.PLAYGROUND_BUSYBOX_JOB:
            Logger.console('Run playground batch');
            NetSuite.runByType('playground', this.objBody.event, this.slack);
            break;
          case ROUTES.NET_SUITE_JOB:
            Logger.console('Run netsuite batch');
            NetSuite.runByType('netsuite', this.objBody.event, this.slack);
            break;
          case ROUTES.FROM_BOT:
            Logger.console('From Bot', JSON.stringify(this.objBody.event));
            LambdaHelper.success('ok');
            break;
          case ROUTES.APP_MENTION:
            Logger.console('App Mention', this.objBody.event);
            LambdaHelper.success('ok');
            break;
          case ROUTES.REGULAR_MESSAGE:
            Logger.console('Ignore Regular Message');
            LambdaHelper.success('ok');
            break;
          default:
            Logger.console('Unknown Route', this.objBody.event);
            LambdaHelper.success('ok');
            break;
        }
      } else {
        Logger.console('Non-Slack', this.event);
        LambdaHelper.fail('error');
      }
    } catch (error) {
      Logger.console('Body parsing error', error);
      LambdaHelper.success(error);
    }
  }

  @Path('/operations/hooks/slack/interactive')
  @Any()
  async processSlackInteractive() {
    try {
      this.parseFormBody();
      await this.validateRequest();
      this.slack = await this.getSlack();
      switch (Router.getRoutesFromSlackActions(this.objBody.payload)) {
        case ROUTES.CICD_APPROVAL_RESPONSE:
          CiCd.approvalResponseFromSlack(this.objBody.payload, this.slack);
          break;
        default:
          LambdaHelper.success({ text: 'done' });
      }
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  @Path('/operations/hooks/slack/menus')
  @Any()
  async processSlackMenus() {
    this.parseFormBody();
    await this.validateRequest();
    Logger.console('menus', this.objBody);
    LambdaHelper.success({ text: 'done' });
  }

  @Path('/operations/hooks/slack/command')
  @Any()
  async processSlackCommands() {
    try {
      this.parseFormBody();
      await this.validateRequest();
      this.slack = await this.getSlack();
      const route = await Router.routesFromCommands(this.objBody, this.region);
      if (route === ROUTES.UNKNOWN) {
        Logger.console(this.objBody);
        const text = `Unknown request: \`${this.objBody.text}\``;
        LambdaHelper.success({ text: text });
      } else {
        await this.processRoute(route, this.objBody);
        let message = 'Success';
        if (route.httpResponseMessage) {
          message = route.httpResponseMessage;
        }
        LambdaHelper.success({ text: `${message}` });
      }
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  @Any()
  async catchAll() {
    try {
      this.slack = await this.getSlack();
      switch (+Router.getRoutesFromTrigger(this.event)) {
        case ROUTES.CICD_APPROVAL_REQUEST:
          CiCd.approvalRequestFromTrigger(this.event.Records[0], this.slack);
          break;
        case ROUTES.SLACK_SEND_MESSAGE_REQUEST:
          this.sendSlackMessage(this.event.Records[0]);
          break;
        default:
          Logger.console(JSON.stringify(this.event));
          LambdaHelper.fail('Not found', 404);
      }
    } catch (error) {
      Logger.console(error);
      LambdaHelper.fail(error);
    }
  }

  private async sendSlackMessage(record) {
    try {
      const message = JSON.parse(record.Sns.Message);
      await this.slack.message(message.message, { channel: message.channel });
      LambdaHelper.success('ok');
    } catch (error) {
      Logger.console(error);
      LambdaHelper.fail(error);
    }
  }

  private isSlackRequest() {
    if (!this.objBody) {
      Logger.console('Empty request', this.event);
      return false;
    } else if (!this.objBody.event) {
      Logger.console('Non Slack request', this.objBody);
      return false;
    } else {
      return true;
    }
  }

  private async processRoute(route: Route, slackInfo: any) {
    const lambda = new LambdaLib({ region: this.region });
    const metadata = { ...route.metadata, slackInfo: slackInfo };
    await lambda.invokeAsync(route.lambda, JSON.stringify(metadata));
    Logger.console(`Invoke success for ${route.lambda}`);
  }

  private parseFormBody() {
    const queryString = require('querystring');
    if (this.event.isBase64Encoded) {
      const base64Decode = Strings.base64Decode(this.event.body);
      this.objBody = queryString.decode(base64Decode);
    } else {
      this.objBody = queryString.decode(this.event.body);
    }
  }

  private parseJsonBody() {
    if (this.event.isBase64Encoded) {
      this.objBody = JSON.parse(Strings.base64Decode(this.event.body));
    } else {
      this.objBody = JSON.parse(this.event.body);
    }
  }

  private getBody() {
    if (this.event.isBase64Encoded) {
      return Strings.base64Decode(this.event.body);
    } else {
      return this.event.body;
    }
  }

  private async getSlack() {
    if (!this.slack) {
      const ssm = new SsmLib({ region: this.region });
      const token = await ssm.getParameter('/BSS/DevOps/Slack/BotToken', true);
      this.slack = new SlackLib({ token: token });
    }
    return this.slack;
  }

  private async validateRequest() {
    try {
      const ssm = new SsmLib({ region: this.region });
      const param = '/BSS/DevOps/Slack/SigningSecret';
      const secret = await ssm.getParameter(param, true);
      const headers = this.event.headers;
      if (!SlackLib.isValidRequest(secret, this.getBody(), headers)) {
        Logger.error('headers:', headers, 'body:', this.body);
        throw new Error('Invalid slack request');
      } else {
        Logger.info('Valid slack request');
      }
    } catch (error) {
      Logger.error('Validation error', error);
    }
  }
}

exports.handler = LambdaHandler;
