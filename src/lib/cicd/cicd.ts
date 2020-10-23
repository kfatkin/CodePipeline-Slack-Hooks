import { LambdaHelper } from '../helpers/lambda-helper';
import { SlackLib } from '../slack/slack';
import { SlackBlocks } from '../slack/slack-blocks';
import * as format from 'string-template';

import { CodePipeline, Lambda } from 'aws-sdk';
import { promisify } from 'util';
import { Logger } from '../../logger';

export interface ApprovalRequest {
  token: string;
  expires: string;
  pipelineName: string;
  approvalReviewLink: string;
  externalEntityLink: string | null;
  customData: string;
  stageName: string;
  actionName: string;
}

export interface ApprovalStageInfo {
  responseMessage?: string;
  requestMessage?: string;
  lambdaArn?: string;
  snsArn?: string;
  appEnv: string;
  slackChannel: string;
}

export interface ActionValue {
  type: string;
  token: string;
  status: string;
  region: string;
  appEnv: string;
  lambdaArn?: string;
  responseMessage?: string;
  pipelineName: string;
}

export class CiCd {
  private config: ApprovalRequest;
  private slack: SlackLib;

  static approvalRequestFromTrigger(record: any, slack: SlackLib) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const cicd = new CiCd(slack);
      cicd.slackApprovalRequest(message.approval);
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  static approvalResponseFromSlack(payload: string, slack: SlackLib) {
    try {
      const cicd = new CiCd(slack);
      const interactive = JSON.parse(payload);
      Logger.console(`Approval response payload: ${payload}`);
      const action: ActionValue = JSON.parse(interactive.actions[0].value);
      if (action.lambdaArn) {
        cicd.invokeRemoteLambda(action.lambdaArn, payload);
      } else {
        cicd.slackApprovalResponse(
          interactive.channel,
          interactive.user,
          interactive.actions[0],
          interactive.message
        );
      }
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  constructor(slack: SlackLib) {
    this.slack = slack;
  }

  async invokeRemoteLambda(arn: string, payload: string) {
    const region = arn.split(':')[3];
    const handler = new Lambda({ region: region });
    const params = { FunctionName: arn, Payload: payload };
    try {
      Logger.console(`Invoke remote lambda`, params);
      const invoke = promisify(handler.invoke.bind(handler));
      const response = await invoke(params);
      LambdaHelper.success(response);
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  async slackApprovalResponse(channel, user, action, message) {
    try {
      const value: ActionValue = JSON.parse(action.value);
      await this.sendCiCdManualResponse(user, value);
      await this.sendSlackApprovalResponse(channel, user, value, message);
      LambdaHelper.success('ok');
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  async slackApprovalRequest(config: ApprovalRequest) {
    this.config = config;
    const customData: ApprovalStageInfo = JSON.parse(this.config.customData);
    const headerTitle = this.getRequestMessage(customData);
    const approvalValue: ActionValue = this.getApproveValue(customData);
    const rejectValue: ActionValue = this.getRejectValue(customData);
    const blockValue = {
      headerTitle: headerTitle,
      approveValue: JSON.stringify(approvalValue),
      rejectValue: JSON.stringify(rejectValue)
    };
    const blocks = SlackBlocks.getApprovalBlock(blockValue);
    const channel = { channel: customData.slackChannel };
    const message = 'CiCd Alert';
    const response = await this.slack.message(message, channel, blocks);
    LambdaHelper.success(response);
  }

  private getApproveValue(customData: ApprovalStageInfo) {
    const commonValue = this.getCommonOnActionValue(customData);
    const approvalValue: ActionValue = {
      type: 'approval_response',
      status: 'approve',
      ...commonValue
    };
    Logger.console(`Approve value`, approvalValue);
    return approvalValue;
  }

  private getRejectValue(customData: ApprovalStageInfo) {
    const commonValue = this.getCommonOnActionValue(customData);
    const rejectValue: ActionValue = {
      type: 'approval_response',
      status: 'reject',
      ...commonValue
    };
    Logger.console(`Reject value`, rejectValue);
    return rejectValue;
  }

  private getCommonOnActionValue(customData: ApprovalStageInfo) {
    const region = customData.snsArn.split(':')[3];
    return {
      region: region,
      token: this.config.token,
      appEnv: customData.appEnv,
      responseMessage: customData.responseMessage,
      lambdaArn: customData.lambdaArn,
      pipelineName: this.config.pipelineName
    };
  }

  private getRequestMessage(customData) {
    const pipelineNameInfo = this.config.pipelineName.split('-');
    const params = {
      AppEnv: customData.appEnv,
      AppName: pipelineNameInfo[pipelineNameInfo.length - 1],
      PipeName: this.config.pipelineName,
      ActionDate: this.getDate(),
      ActionDateHour: this.getDateHour()
    };
    let message = `Approve the latest changes for ${this.config.pipelineName}`;
    if (customData.requestMessage) {
      message = format(customData.requestMessage, params);
    }
    return message;
  }

  private getResponseMessage(status, user, action) {
    const pipelineNameInfo = action.pipelineName.split('-');
    const params = {
      AppEnv: action.appEnv,
      AppName: pipelineNameInfo[pipelineNameInfo.length - 1],
      PipeName: action.pipelineName,
      ActionDate: this.getDate(),
      ActionDateHour: this.getDateHour(),
      ActingUser: user.username,
      ActionStatus: status
    };
    let message = `${status} by @${user.username}`;
    if (action.responseMessage) {
      message = format(action.responseMessage, params);
    }
    return message;
  }

  private getDate() {
    const d = new Date();
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) {
      month = '0' + month;
    }
    if (day.length < 2) {
      day = '0' + day;
    }

    return [year, month, day].join('/');
  }

  private getDateHour() {
    const date = new Date();
    const aaaa = date.getFullYear();
    let gg: string | number = date.getDate();
    let mm: string | number = date.getMonth() + 1;

    if (gg < 10) {
      gg = '0' + gg;
    }

    if (mm < 10) {
      mm = '0' + mm;
    }

    const curDay = aaaa + '-' + mm + '-' + gg;

    let hours: string | number = date.getHours();
    let minutes: string | number = date.getMinutes();
    let seconds: string | number = date.getSeconds();

    if (hours < 10) {
      hours = '0' + hours;
    }
    if (minutes < 10) {
      minutes = '0' + minutes;
    }
    if (seconds < 10) {
      seconds = '0' + seconds;
    }
    return curDay + ' ' + hours + ':' + minutes + ':' + seconds;
  }

  private async sendCiCdManualResponse(user, action: ActionValue) {
    action.region = this.getRegionFromAction(action);
    const status = this.getStatusFromAction(action);
    const cicd = new CodePipeline({ region: action.region });
    const summary = this.getResponseMessage(status, user, action);
    const putApprovalResult = promisify(cicd.putApprovalResult.bind(cicd));
    const params = {
      actionName: 'AppApproval',
      pipelineName: action.pipelineName,
      token: action.token,
      stageName: 'Approval',
      result: { status: status, summary: summary }
    };
    const response = await putApprovalResult(params);
    return response;
  }

  private getRegionFromAction(action) {
    if (action.region) {
      return action.region;
    }
    return 'us-east-1';
  }

  private getStatusFromAction(action) {
    let status = 'Approved';
    if (action.status !== 'approve') {
      status = 'Rejected';
    }
    return status;
  }

  private async sendSlackApprovalResponse(channel, user, action, message) {
    const status = this.getStatusFromAction(action);
    let response = `${status} by <@${user.id}>`;
    if (action.responseMessage) {
      response = this.getResponseMessage(status, user, action);
    }
    const blockItem = this.getBlockItem(response);
    const channelInfo = {
      channel: channel.id,
      ts: message.ts
    };
    const blocks = message.blocks;
    blocks[3] = blockItem;
    await this.slack.update('CiCd Alert', channelInfo, blocks);
  }

  private getBlockItem(response) {
    return {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: response
      }
    };
  }
}
