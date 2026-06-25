// api/complete.js
// Receives manager's completed selections, triggers Jira Automation webhook
// to post a formatted comment on the existing ticket — no API token needed.
// POST /api/complete

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, software, hardware, permissions, notes } = req.body;

    // Decode the IT form data from the token
    let itData;
    try {
      itData = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    const jiraKey = itData.jira;
    if (!jiraKey) {
      return res.status(400).json({ error: 'No Jira ticket key in token' });
    }

    const webhookUrl = process.env.JIRA_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'JIRA_WEBHOOK_URL not configured' });
    }

    const startDate = itData.sd
      ? new Date(itData.sd + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
      : itData.sd || 'Not specified';

    const swList  = (software || []).length ? software.join(', ') : 'None selected';
    const hwList  = (hardware || []).length ? hardware.join(', ') : 'None requested';

    const permParts = [];
    if (permissions?.mirrorUser)    permParts.push(`Mirror user: ${permissions.mirrorUser}`);
    if (permissions?.adminAccess)   permParts.push(`Admin Access: Yes (pending InfoSec approval)`);
    if (permissions?.googleGroups)  permParts.push(`Google Groups: ${permissions.googleGroups}`);
    if (permissions?.slackChannels) permParts.push(`Slack Channels: ${permissions.slackChannels}`);
    if (permissions?.distLists)     permParts.push(`Distribution Lists: ${permissions.distLists}`);
    if (permissions?.drives)        permParts.push(`Department Drives: ${permissions.drives}`);
    if (permissions?.snapfulfil)    permParts.push(`Snapfulfil mirror: ${permissions.snapfulfil}`);
    const permStr = permParts.length ? permParts.join(' | ') : 'None specified';

    // POST to Jira Automation incoming webhook
    // "issues" tells Jira which ticket to run the automation on
    // All other fields are accessible in the rule as {{webhookData.fieldName}}
    const webhookPayload = {
      issues: [jiraKey],
      name:        `${itData.fn} ${itData.ln}`,
      title:       `${itData.jt} · ${itData.dept}`,
      startDate,
      empType:     itData.et  || '',
      location:    itData.loc || 'Not specified',
      priority:    itData.pri || 'standard',
      manager:     `${itData.mgr} (${itData.mgrEm})`,
      software:    swList,
      hardware:    hwList,
      permissions: permStr,
      notes:       notes || 'None',
      itNotes:     itData.notes || 'None'
    };

    const webhookSecret = process.env.JIRA_WEBHOOK_SECRET;
    const finalUrl = webhookSecret
      ? `${webhookUrl}${webhookUrl.includes('?') ? '&' : '?'}token=${encodeURIComponent(webhookSecret)}`
      : webhookUrl;

    const jiraRes = await fetch(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    if (!jiraRes.ok) {
      const errText = await jiraRes.text();
      console.error('Jira webhook error:', jiraRes.status, errText);
      return res.status(502).json({
        error: 'Failed to trigger Jira automation',
        status: jiraRes.status
      });
    }

    // Optional Slack notification
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhook) {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `✅ *${itData.fn} ${itData.ln}* onboarding form completed by ${itData.mgr}.\nJira ticket *${jiraKey}* has been updated. Start date: ${startDate}`
        })
      }).catch(e => console.error('Slack notify failed:', e));
    }

    return res.status(200).json({ success: true, jiraKey });

  } catch (err) {
    console.error('complete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
