import { Writable } from 'stream';

export class Prompts {
  static async question(message: string, muted?: boolean) {
    return new Promise<string>((resolve, reject) => {
      const mutableStdout = new Writable({
        write: (chunk: any, encoding: string, callback: Function) => {
          if (!muted) {
            process.stdout.write(chunk, encoding);
          } else {
            if (chunk && chunk.toString().trim().length === 1) {
              process.stdout.write('*');
            }
          }
          callback();
        }
      });
      const readline = require('readline');
      const readLine = readline.createInterface({
        input: process.stdin,
        output: mutableStdout,
        terminal: true
      });
      readLine.question(message, (answer: string) => {
        resolve(answer);
        readLine.close();
      });
    });
  }

  static async sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }
}
