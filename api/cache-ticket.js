// api/cache-ticket.js
// Called by Jira Automation when an "Onboard new employees" ticket is created.
// Stores the ticket's form data in Vercel KV so the portal can auto-fill the IT form.
// POST /api/cache-ticket

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: protect with a shared secret so only your Jira Automation can write here
  const secret = req.headers['x-automation-webhook-token'];
  const expectedSecret = process.env.CACHE_TICKET_SECRET;
  if (expectedSecret && secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body;
  const key = body.key; // e.g. "ITN-1172"

  if (!key) {
    return res.status(400).json({ error: 'Missing ticket key' });
  }

  // Normalize the data coming from Jira Automation smart values
  const ticketData = {
    key,
    firstName:     (body.firstName     || '').trim(),
    lastName:      (body.lastName      || '').trim(),
    email:         (body.email         || '').trim(),
    jobTitle:      (body.jobTitle      || '').trim(),
    empType:       normalizeEmpType(body.empType || ''),
    location:      normalizeLocation(body.location || ''),
    startDate:     normalizeDate(body.startDate || ''),
    manager:       (body.manager       || '').trim(),
    hardware:      (body.machinery     || '').toLowerCase().includes('yes'),
    notes:         (body.notes         || '').trim(),
    cachedAt:      new Date().toISOString()
  };

  // Store for 120 days (plenty of time for IT to process)
  await kv.set(`ticket:${key}`, ticketData, { ex: 60 * 60 * 24 * 120 });

  console.log(`Cached ticket ${key}`);
  return res.status(200).json({ success: true, key });
}

// Map Jira emp type values to our dropdown options
function normalizeEmpType(raw) {
  const r = raw.toLowerCase();
  if (r.includes('part'))       return 'Part Time';
  if (r.includes('contract'))   return 'Contractor';
  if (r.includes('intern'))     return 'Intern';
  return 'Full Time'; // default for FTE / Full Time Employee
}

// Map Jira location (country/state) to our three options
function normalizeLocation(raw) {
  const r = raw.toLowerCase();
  if (r.includes('warehouse'))  return 'Warehouse';
  // Non-US countries → Remote Overseas
  const usTerms = ['us', 'usa', 'united states', 'new york', 'ny', 'nj', 'ca', 'texas'];
  if (usTerms.some(t => r.includes(t))) return 'Remote';
  if (r.trim() === '')          return '';
  return 'Remote Overseas'; // anything else is international
}

// Normalize date strings from Jira (various formats) to YYYY-MM-DD
function normalizeDate(raw) {
  if (!raw) return '';
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}
