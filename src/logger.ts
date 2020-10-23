export class Logger {
  static info(...args: any[]) {
    const info = ['INFO', new Date() + ''];
    // tslint:disable-next-line:no-console
    console.log.apply(console.log, info.concat(args));
  }
  static error(...args: any[]) {
    const info = ['ERROR', new Date() + ''];
    // tslint:disable-next-line:no-console
    console.log.apply(console.log, info.concat(args));
  }

  static console(...args: any[]) {
    // tslint:disable-next-line:no-console
    console.log.apply(console.log, args);
  }
}
