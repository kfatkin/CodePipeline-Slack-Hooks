const SLACK_APPROVAL_BLOCK = [
  {
    type: 'divider'
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: 'Approval Message'
    }
  },
  {
    type: 'divider'
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Approve',
          emoji: true
        },
        value: 'approve'
      },
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: 'Reject',
          emoji: true
        },
        value: 'reject'
      }
    ]
  }
];

export interface ApprovalRequestProps {
  rejectValue: string;
  approveValue: string;
  headerTitle: string;
}

export class SlackBlocks {
  static getApprovalBlock(props: ApprovalRequestProps) {
    const blocks = JSON.parse(JSON.stringify(SLACK_APPROVAL_BLOCK));
    blocks[1].text.text = props.headerTitle;
    blocks[3].elements[0].value = props.approveValue;
    blocks[3].elements[1].value = props.rejectValue;
    return blocks;
  }
}
