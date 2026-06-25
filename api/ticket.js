// api/ticket.js
// Returns stored ticket data for a given ticket key.
// The portal calls this when IT enters a ticket number to auto-fill the form.
// GET /api/ticket?key=ITN-1172

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { key } = req.query;
  if (!key) {
    return res.status(400).json({ error: 'Missing key parameter' });
  }

  const normalized = key.toUpperCase().trim();
  const data = await kv.get(`ticket:${normalized}`);

  if (!data) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  return res.status(200).json(data);
}
