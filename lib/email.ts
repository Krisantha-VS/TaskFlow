export async function sendInviteEmail(to: string, boardName: string, inviteUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[invite] ${to} → ${inviteUrl}`);
    return;
  }
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'TaskFlow <noreply@taskflow-gamma-liard.vercel.app>',
      to,
      subject: `You've been invited to "${boardName}" on TaskFlow`,
      html: `<p>You've been invited to collaborate on the board <strong>${boardName}</strong>.</p><p><a href="${inviteUrl}">Accept invitation</a></p>`,
    }),
  });
}
