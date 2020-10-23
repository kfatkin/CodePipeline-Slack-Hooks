import { promisify } from 'util';
import { ELBv2 } from 'aws-sdk';
import {
  DescribeListenersInput,
  DescribeListenersOutput,
  DescribeRulesOutput,
  DescribeTargetHealthInput,
  DescribeTargetHealthOutput
} from 'aws-sdk/clients/elbv2';

export interface ElbV2LibConfig {
  region: string;
}

export class ElbV2Lib {
  private config: ElbV2LibConfig;
  private handler: ELBv2;

  constructor(config: ElbV2LibConfig) {
    this.config = config;
    this.handler = new ELBv2({ region: this.config.region });
  }

  async getRules(listeners: DescribeListenersOutput) {
    const Items: DescribeRulesOutput[] = [];
    const response = {
      Items: Items
    };
    const getRules = promisify(this.handler.describeRules.bind(this.handler));
    for (const listener of listeners.Listeners) {
      const listenerArn = listener.ListenerArn;
      Items.push(await getRules({ ListenerArn: listenerArn }));
    }
    return response;
  }

  async getTargetGroupInstances(targetGroupArn: string) {
    const params: DescribeTargetHealthInput = {
      TargetGroupArn: targetGroupArn
    };
    const describeTargetHealth = promisify(
      this.handler.describeTargetHealth.bind(this.handler)
    );
    const response: DescribeTargetHealthOutput = await describeTargetHealth(
      params
    );
    return response;
  }

  async isTargetGroupHealthy(targetGroupArn: string) {
    const params: DescribeTargetHealthInput = {
      TargetGroupArn: targetGroupArn
    };
    const describeTargetHealth = promisify(
      this.handler.describeTargetHealth.bind(this.handler)
    );
    const response: DescribeTargetHealthOutput = await describeTargetHealth(
      params
    );
    for (const target of response.TargetHealthDescriptions) {
      if (target.TargetHealth.State !== 'healthy') {
        return false;
      }
    }
    return true;
  }

  async getInstancesIds(intancesInfo: DescribeTargetHealthOutput) {
    const ids: string[] = [];
    for (const description of intancesInfo.TargetHealthDescriptions) {
      ids.push(description.Target.Id);
    }
    return ids;
  }

  async swapDomains(describeRules: DescribeRulesOutput[]) {
    const modifyRule = promisify(this.handler.modifyRule.bind(this.handler));
    const status = [];
    for (const rules of describeRules) {
      const rule1Params = {
        Conditions: [
          {
            Field: 'host-header',
            Values: [rules.Rules[1].Conditions[0].Values[0]]
          }
        ],
        RuleArn: rules.Rules[0].RuleArn
      };
      const rule2Params = {
        Conditions: [
          {
            Field: 'host-header',
            Values: [rules.Rules[0].Conditions[0].Values[0]]
          }
        ],
        RuleArn: rules.Rules[1].RuleArn
      };
      status.push(await modifyRule(rule1Params));
      status.push(await modifyRule(rule2Params));
    }
    return status;
  }

  async getTargetGroupsByHeader(
    describeRules: DescribeRulesOutput[],
    pattern: RegExp
  ) {
    const targetGroups: string[] = [];
    for (const rules of describeRules) {
      for (const rule of rules.Rules) {
        for (const condition of rule.Conditions) {
          if (condition.Field === 'host-header') {
            const patternMatch = condition.Values[0].match(pattern);
            if (patternMatch) {
              const action = rule.Actions[0];
              if (action) {
                targetGroups.push(action.TargetGroupArn);
              }
            }
          }
        }
      }
    }
    return targetGroups;
  }

  async getListeners(arn: string) {
    const params: DescribeListenersInput = { LoadBalancerArn: arn };
    const getListeners = promisify(
      this.handler.describeListeners.bind(this.handler)
    );
    const listeners: DescribeListenersOutput = await getListeners(params);
    return listeners;
  }
}
