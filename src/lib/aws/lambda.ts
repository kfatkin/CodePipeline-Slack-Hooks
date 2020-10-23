import { Lambda } from 'aws-sdk';
import { promisify } from 'util';
export interface LambdaConfig {
  region: string;
}
export class LambdaLib {
  private config: LambdaConfig;
  private lambdaHandler: Lambda;

  constructor(config: LambdaConfig) {
    this.config = config;
    this.lambdaHandler = new Lambda({ region: this.config.region });
  }

  async invokeAsync(name: string, args: any) {
    const params = {
      FunctionName: name,
      InvokeArgs: args
    };
    const invoke = promisify(
      this.lambdaHandler.invokeAsync.bind(this.lambdaHandler)
    );
    return await invoke(params);
  }
}
