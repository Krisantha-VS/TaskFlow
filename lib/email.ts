const ROYALDA_MAIL_URL = 'https://mail.royalda.com/api/v1/send';
const ROYALDA_MAIL_KEY = process.env.ROYALDA_MAIL_API_KEY!;
const FROM = 'noreply@royalda.com';

async function sendMail(to: string, subject: string, html: string) {
  if (!ROYALDA_MAIL_KEY) {
    console.log(`[email] ROYALDA_MAIL_API_KEY not set — skipping send to ${to}`);
    return;
  }
  const res = await fetch(ROYALDA_MAIL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ROYALDA_MAIL_KEY}`,
    },
    body: JSON.stringify({ to, subject, html, from: FROM }),
  });
  if (!res.ok) throw new Error(`Mail error: ${res.status}`);
}

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>TaskFlow</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(124,58,237,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);padding:28px 32px;">
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">TaskFlow</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f3f0ff;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;">You received this email because you are part of a TaskFlow workspace.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendInviteEmail(to: string, boardName: string, inviteUrl: string) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1f2937;">You've been invited!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">
      You've been invited to collaborate on the board <strong style="color:#7c3aed;">${boardName}</strong> on TaskFlow.
    </p>
    <a href="${inviteUrl}"
       style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
      Accept Invitation
    </a>
    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">
      Or copy this link: <a href="${inviteUrl}" style="color:#7c3aed;">${inviteUrl}</a>
    </p>
  `);
  await sendMail(to, `You've been invited to "${boardName}" on TaskFlow`, html);
}

export async function sendTaskAssignedEmail(
  to: string,
  taskTitle: string,
  boardName: string,
  taskUrl: string,
) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1f2937;">Task assigned to you</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.6;">
      You've been assigned a task on <strong style="color:#7c3aed;">${boardName}</strong>:
    </p>
    <div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:6px;padding:14px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:15px;font-weight:600;color:#1f2937;">${taskTitle}</p>
    </div>
    <a href="${taskUrl}"
       style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
      View Task
    </a>
  `);
  await sendMail(to, `You've been assigned: "${taskTitle}"`, html);
}

export async function sendCommentEmail(
  to: string,
  taskTitle: string,
  commenterName: string,
  comment: string,
  taskUrl: string,
) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1f2937;">New comment on your task</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.6;">
      <strong style="color:#7c3aed;">${commenterName}</strong> commented on <strong>${taskTitle}</strong>:
    </p>
    <div style="background:#f9f7ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px 18px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${comment}</p>
    </div>
    <a href="${taskUrl}"
       style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
      Reply to Comment
    </a>
  `);
  await sendMail(to, `New comment on "${taskTitle}"`, html);
}

export async function sendTaskDueSoonEmail(
  to: string,
  taskTitle: string,
  dueDate: string,
  taskUrl: string,
) {
  const html = baseTemplate(`
    <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1f2937;">Task due soon</h2>
    <p style="margin:0 0 8px;font-size:15px;color:#4b5563;line-height:1.6;">
      A task assigned to you is due soon:
    </p>
    <div style="background:#f5f3ff;border-left:4px solid #7c3aed;border-radius:6px;padding:14px 18px;margin:0 0 8px;">
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1f2937;">${taskTitle}</p>
      <p style="margin:0;font-size:13px;color:#7c3aed;">Due: ${dueDate}</p>
    </div>
    <p style="margin:0 0 24px;font-size:13px;color:#9ca3af;">Don't let it slip through!</p>
    <a href="${taskUrl}"
       style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">
      View Task
    </a>
  `);
  await sendMail(to, `Reminder: "${taskTitle}" is due soon`, html);
}
