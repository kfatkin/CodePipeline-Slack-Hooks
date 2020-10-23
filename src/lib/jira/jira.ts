import { LambdaHelper } from "../helpers/lambda-helper";
import { SlackLib } from "../slack/slack";

export class JiraLib {
  private event: any;
  private slack: SlackLib;

  static hasTicket(text: string) {
    if (!text) {
      return false;
    }
    if (text.match(/\s+TECH-\d+/gm)) {
      return true;
    }
    if (text.match(/^TECH-\d+ /)) {
      return true;
    }
    if (text.match(/\s+AUTO-\d+/gm)) {
      return true;
    }
    if (text.match(/^AUTO-\d+ /)) {
      return true;
    }
    if (text.match(/\s+CO-\d+/gm)) {
      return true;
    }
    if (text.match(/^CO-\d+ /)) {
      return true;
    }
    return false;
  }

  static getTickets(text: string) {
    let techMatches = [];
    techMatches = [...techMatches, ...text.match(/\s+(TECH-\d+)/gm)];
    techMatches = [...techMatches, ...text.match(/^(TECH-\d+)/)];
    techMatches = [...techMatches, ...text.match(/\s+(AUTO-\d+)/gm)];
    techMatches = [...techMatches, ...text.match(/^(AUTO-\d+) /)];
    techMatches = [...techMatches, ...text.match(/\s+(CO-\d+)/gm)];
    techMatches = [...techMatches, ...text.match(/^(CO-\d+) /)];
    techMatches = techMatches.filter(item => item);
    techMatches = techMatches.map(item => item.trim());
    techMatches = techMatches.filter((el, i, self) => i === self.indexOf(el));
    return techMatches;
  }

  static formatTickets(tickets: string[]) {
    if (!tickets || tickets.length <= 0) {
      return [];
    }
    const jiraPath = "https://beaconstreetservices.atlassian.net/browse";
    return tickets.map(item => `<${jiraPath}/${item}|${item}>`);
  }

  constructor(event: any, slack: SlackLib) {
    this.event = event;
    this.slack = slack;
    this.run();
  }

  private async run() {
    const event = this.event;
    if (event && event.text) {
      const tickets = JiraLib.getTickets(event.text);
      const formattedTickets = JiraLib.formatTickets(tickets);
      if (formattedTickets.length) {
        const message = `Jira Links Found: ${formattedTickets.join(" ")}`;
        await this.slack.message(message, event);
      }
      LambdaHelper.success(formattedTickets);
    } else {
      LambdaHelper.success("ok");
    }
  }
}
