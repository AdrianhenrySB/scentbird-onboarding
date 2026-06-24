// api/intake.js
// Receives IT form data, returns a base64-encoded manager URL
// POST /api/intake

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = req.body;

    // Validate required fields
    const required = ['firstName', 'lastName', 'personalEmail', 'startDate',
                      'department', 'jobTitle', 'manager', 'managerEmail',
                      'empType', 'jiraKey'];
    const missing = required.filter(f => !data[f]);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', missing });
    }

    // Encode all IT form data into a compact token
    const payload = {
      fn:   data.firstName,
      ln:   data.lastName,
      em:   data.personalEmail,
      sd:   data.startDate,
      dept: data.department,
      jt:   data.jobTitle,
      mgr:  data.manager,
      mgrEm:data.managerEmail,
      et:   data.empType,
      loc:  data.location || '',
      pri:  data.priority || 'standard',
      hw:   data.hardwareRequested ? 1 : 0,
      jira: data.jiraKey,
      notes:data.itNotes || '',
      ts:   Date.now()
    };

    const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const baseUrl = process.env.BASE_URL || `https://${req.headers.host}`;
    const managerUrl = `${baseUrl}?token=${token}`;

    return res.status(200).json({ managerUrl, token });
  } catch (err) {
    console.error('intake error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
