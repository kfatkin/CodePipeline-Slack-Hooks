import { Batch, AWSError } from 'aws-sdk';
import { SubmitJobResponse } from 'aws-sdk/clients/batch';
import { SlackLib } from '../slack/slack';
import { LambdaHelper } from '../helpers/lambda-helper';
import { Logger } from '../../logger';

const PLAYGROUND = {
  JobArn:
    'arn:aws:batch:us-east-1:880392359248:job-definition/DevOpsPlaygroundBusybox-083777d4404ac84:1',
  JobQueueArn: 'arn:aws:batch:us-east-1:880392359248:job-queue/BSS-DevOps-Queue'
};

const NET_SUITE = {
  JobArn:
    'arn:aws:batch:us-east-1:880392359248:job-definition/DevOpsNscManager-d29acf5d2f263e0:1',
  JobQueueArn: 'arn:aws:batch:us-east-1:880392359248:job-queue/BSS-DevOps-Queue'
};

export class NetSuite {
  slack: SlackLib;
  event: any;
  private batch = new Batch({ region: 'us-east-1' });

  static runByType(type: string, event, slack) {
    try {
      const netSuite = new NetSuite(event, slack);
      netSuite.runByType(type);
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  constructor(event: any, slack: SlackLib) {
    this.event = event;
    this.slack = slack;
  }

  run() {
    return new Promise<SubmitJobResponse | AWSError>((resolve, reject) => {
      const jobInfo = this.getJobInfo();
      this.batch.submitJob(jobInfo, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  runPlayground() {
    return new Promise<SubmitJobResponse | AWSError>((resolve, reject) => {
      const jobInfo = this.getPlaygroundJobInfo();
      this.batch.submitJob(jobInfo, (error, data) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  }

  async sendSlackResponse(runInfo: any, type: string) {
    try {
      let message: string;
      if (type === 'netsuite') {
        message = `Running NetSuite Manager, JobId: \`${runInfo.jobId}\``;
      } else if (type === 'playground') {
        message = `Running Playground Busybox, JobId: \`${runInfo.jobId}\``;
      } else {
        message = `Unknown type ${type}, JobId: \`${runInfo.jobId}\``;
      }
      if (runInfo && runInfo.jobId) {
        const success = message;
        await this.slack.message(success, { ...this.event });
      } else {
        const failed = `Failed to run \`${type}\``;
        await this.slack.message(failed, { ...this.event });
      }
      LambdaHelper.success('ok');
    } catch (error) {
      LambdaHelper.fail(error);
    }
  }

  async runByType(type: string) {
    let runInfo;
    if (type === 'playground') {
      runInfo = await this.runPlayground();
    } else if (type === 'netsuite') {
      runInfo = await this.run();
    }
    await this.sendSlackResponse(runInfo, type);
  }

  private getJobInfo() {
    const timestamp = new Date().getTime();
    return {
      jobName: `NetSuite-${timestamp}`,
      jobQueue: NET_SUITE.JobQueueArn,
      jobDefinition: NET_SUITE.JobArn
    };
  }

  private getPlaygroundJobInfo() {
    const timestamp = new Date().getTime();
    return {
      jobName: `Playground-${timestamp}`,
      jobQueue: PLAYGROUND.JobQueueArn,
      jobDefinition: PLAYGROUND.JobArn
    };
  }
}
