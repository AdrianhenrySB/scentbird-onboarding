// api/complete.js
// Receives manager's completed selections, posts a comment to the existing Jira ticket
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

    // Build a clean comment body
    const startDate = itData.sd
      ? new Date(itData.sd + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })
      : itData.sd;

    const swList  = (software || []).length  ? software.join(', ')  : '_None selected_';
    const hwList  = (hardware || []).length  ? hardware.join(', ')  : '_None requested_';

    const permLines = [];
    if (permissions?.mirrorUser)    permLines.push(`* *Mirror user:* ${permissions.mirrorUser}`);
    if (permissions?.adminAccess)   permLines.push(`* *Admin Access:* Yes — pending InfoSec approval`);
    if (permissions?.googleGroups)  permLines.push(`* *Google Groups:* ${permissions.googleGroups}`);
    if (permissions?.slackChannels) permLines.push(`* *Slack Channels:* ${permissions.slackChannels}`);
    if (permissions?.distLists)     permLines.push(`* *Distribution Lists:* ${permissions.distLists}`);
    if (permissions?.drives)        permLines.push(`* *Department Drives:* ${permissions.drives}`);
    if (permissions?.snapfulfil)    permLines.push(`* *Snapfulfil mirror:* ${permissions.snapfulfil}`);
    const permSection = permLines.length ? permLines.join('\n') : '_None specified_';

    const comment = `*✅ Manager onboarding form completed*

----

*Employee:* ${itData.fn} ${itData.ln}
*Title / Dept:* ${itData.jt} · ${itData.dept}
*Start Date:* ${startDate}
*Employment Type:* ${itData.et}
*Location:* ${itData.loc || 'Not specified'}
*Priority:* ${itData.pri || 'standard'}
*Hiring Manager:* ${itData.mgr} (${itData.mgrEm})

----

*💻 Software Access Requested:*
${swList}

*🖥️ Hardware Requested:*
${hwList}

*🔑 Permissions & Access:*
${permSection}

${notes ? `*📝 Manager Notes:*\n${notes}\n\n` : ''}----
_Form submitted by hiring manager via IT Onboarding Portal. Please begin provisioning._`;

    // Post comment to Jira
    const jiraDomain = process.env.JIRA_DOMAIN;   // e.g. scentbird.atlassian.net
    const jiraEmail  = process.env.JIRA_EMAIL;    // service account email
    const jiraToken  = process.env.JIRA_API_TOKEN; // API token for that account

    if (!jiraDomain || !jiraEmail || !jiraToken) {
      console.error('Missing Jira env vars');
      return res.status(500).json({ error: 'Jira not configured' });
    }

    const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
    const jiraRes = await fetch(
      `https://${jiraDomain}/rest/api/2/issue/${jiraKey}/comment`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ body: comment })
      }
    );

    if (!jiraRes.ok) {
      const errText = await jiraRes.text();
      console.error('Jira error:', jiraRes.status, errText);
      return res.status(502).json({
        error: 'Failed to update Jira ticket',
        status: jiraRes.status,
        detail: errText
      });
    }

    // Optional Slack notification
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;
    if (slackWebhook) {
      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `✅ *${itData.fn} ${itData.ln}* onboarding form completed by ${itData.mgr}.\nJira: <https://${jiraDomain}/browse/${jiraKey}|${jiraKey}> · Start: ${startDate}`
        })
      }).catch(e => console.error('Slack notify failed:', e));
    }

    return res.status(200).json({ success: true, jiraKey });

  } catch (err) {
    console.error('complete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
