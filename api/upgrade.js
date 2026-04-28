// api/upgrade.js
import { createClient } from '@supabase/supabase-js';

const SLACK_URL = 'https://slack.com/api/chat.postMessage';
const SLACK_TOKEN = process.env.SLACK_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validate environment variables
  if (!SLACK_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Missing Environment Variables. Please set SLACK_TOKEN, SUPABASE_URL, and SUPABASE_ANON_KEY in Vercel.');
    return res.status(500).json({ error: 'Server configuration error: Missing environment variables.' });
  }

  const { name, email, ip, location, device } = req.body;

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // 1. Save to Supabase
    const { error: dbError } = await supabase
      .from('leads')
      .insert([{ name, email, ip, location, device }]);

    if (dbError) {
      console.error('Supabase error:', dbError);
      // We continue anyway so the user doesn't see a failure if only DB fails
    }

    // 2. Send to Slack
    const slackMessage = {
      channel: SLACK_CHANNEL_ID,
      text: `🚀 *New Pro Upgrade Lead!*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🚀 *New Pro Upgrade Lead!*\n\n*Name:* ${name}\n*Email:* ${email}`
          }
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Location:* ${location || 'Unknown'}` },
            { type: "mrkdwn", text: `*IP:* ${ip || 'Unknown'}` },
            { type: "mrkdwn", text: `*Device:* ${device || 'Unknown'}` }
          ]
        }
      ]
    };

    const slackRes = await fetch(SLACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SLACK_TOKEN}`
      },
      body: JSON.stringify(slackMessage)
    });

    const slackData = await slackRes.json();
    if (!slackData.ok) {
      console.error('Slack error:', slackData.error);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
