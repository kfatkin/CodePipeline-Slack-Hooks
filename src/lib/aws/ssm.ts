import { SSM } from 'aws-sdk';
import { promisify } from 'util';
import {
  SendCommandRequest,
  SendCommandResult,
  Command,
  GetParameterRequest
} from 'aws-sdk/clients/ssm';
import { Prompts } from '../helpers/prompts';
import { Logger } from '../../logger';

export interface SsmConfig {
  region: string;
}

export interface SsmSendCommandRequest {
  appName: string;
  appEnv: string;
  username: string;
  commands: string[];
  ids: string[];
}

export class SsmLib {
  test;
  private config: SsmConfig;
  private handler: SSM;

  constructor(config: SsmConfig) {
    this.config = config;
    this.handler = new SSM({ region: this.config.region });
  }

  async sendCommand(request: SsmSendCommandRequest) {
    const params: SendCommandRequest = {
      DocumentName: 'AWS-RunShellScript',
      Comment: `${request.appName} (${request.appEnv}) updated by <@${request.username}>`,
      Parameters: { commands: request.commands },
      CloudWatchOutputConfig: {
        CloudWatchOutputEnabled: true,
        CloudWatchLogGroupName: '/aws/ssm/BSS-DevOps-SsmJavaApps'
      },
      InstanceIds: request.ids
    };

    const sendCommand = promisify(this.handler.sendCommand.bind(this.handler));
    const response: SendCommandResult = await sendCommand(params);
    return response;
  }

  async waitCommandTillDone(commandId: string, sleep: number) {
    const listCommands = promisify(
      this.handler.listCommands.bind(this.handler)
    );
    let done = false;
    let command: Command;
    while (!done) {
      const response = await listCommands({ CommandId: commandId });
      command = response.Commands[0];
      if (command.Status !== 'Pending' && command.Status !== 'InProgress') {
        done = true;
      } else {
        Logger.console(`Command id: ${commandId}, status: ${command.Status}`);
        await Prompts.sleep(sleep);
      }
    }
    return command;
  }

  async getParameter(name: string, decrypt?: boolean) {
    const callback = this.handler.getParameter.bind(this.handler);
    const getParameter = promisify(callback);
    if (decrypt) {
      const params: GetParameterRequest = { Name: name, WithDecryption: true };
      const response = await getParameter(params);
      return response.Parameter.Value;
    } else {
      const params: GetParameterRequest = { Name: name };
      const response = await getParameter(params);
      return response.Parameter.Value;
    }
  }
}
