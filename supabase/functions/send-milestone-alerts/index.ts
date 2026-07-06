// Deploy with: supabase functions deploy send-milestone-alerts --no-verify-jwt
// (pg_cron invokes this with no auth header — see supabase/schema.sql)
//
// Required secrets (supabase secrets set KEY=value):
//   RESEND_API_KEY   — from resend.com
//   FROM_EMAIL       — optional, defaults to Resend's sandbox sender
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase Edge Functions runtime — no need to set them yourself.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FREE_DWELL_HOURS = 72;
const HOURLY_FEE = 50;
const MILESTONES = [24, 48, 60, 72];

const MESSAGES: Record<number, { subject: string; body: string; ccSeller: boolean }> = {
  24: {
    subject: '🟢 Container cleared and grounded in ICD',
    body: 'Your container has cleared customs and is grounded in the ICD. Please assign your transport fleet to avoid storage fees.',
    ccSeller: false,
  },
  48: {
    subject: '🟡 Urgent: 24 hours left in free storage window',
    body: '24 hours remain in the standard free dwell window. Secure gate passes immediately to avoid storage fees.',
    ccSeller: true,
  },
  60: {
    subject: '🔴 Critical: 12 hours before storage fees begin',
    body: `12 hours remain before a $${HOURLY_FEE}/hour per-container storage fee initiates. Priority gate clearance recommended.`,
    ccSeller: true,
  },
  72: {
    subject: '🚨 Storage fee now active',
    body: `The free ${FREE_DWELL_HOURS}-hour dwell window has elapsed. A $${HOURLY_FEE}/hour storage fee is now accruing on this container until gate-out.`,
    ccSeller: true,
  },
};

function highestNewMilestone(hoursElapsed: number, lastSent: number): number | null {
  let result: number | null = null;
  for (const m of MILESTONES) {
    if (hoursElapsed >= m && lastSent < m) result = m;
  }
  return result;
}

async function sendEmail(apiKey: string, from: string, to: string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error (${res.status}): ${text}`);
  }
}

Deno.serve(async (_req) => {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('FROM_EMAIL') || 'Titan ICD <onboarding@resend.dev>';
  if (!resendKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY secret not set' }), { status: 500 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: containers, error } = await supabase
    .from('containers')
    .select('id, gate_in_time, owner_email, last_milestone_sent, seller_id, profiles(email)')
    .eq('status', 'IN_ICD');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const results: Array<{ id: string; milestone: number; ok: boolean }> = [];

  for (const container of containers ?? []) {
    const hoursElapsed = Math.floor((Date.now() - new Date(container.gate_in_time).getTime()) / (1000 * 60 * 60));
    const milestone = highestNewMilestone(hoursElapsed, container.last_milestone_sent);
    if (milestone === null) continue;

    const { subject, body, ccSeller } = MESSAGES[milestone];
    const to = [container.owner_email];
    const sellerEmail = (container as any).profiles?.email;
    if (ccSeller && sellerEmail) to.push(sellerEmail);

    const html = `
      <p>${body}</p>
      <p style="color:#64748b;font-family:monospace;font-size:12px;">
        Container: <b>${container.id}</b><br/>
        Hours in ICD: ${hoursElapsed}
      </p>
    `;

    try {
      await sendEmail(resendKey, fromEmail, to, `${subject} — ${container.id}`, html);
      await supabase.from('containers').update({ last_milestone_sent: milestone }).eq('id', container.id);
      results.push({ id: container.id, milestone, ok: true });
    } catch (e) {
      results.push({ id: container.id, milestone, ok: false });
      console.error(`Failed to send milestone ${milestone} for ${container.id}:`, e);
    }
  }

  return new Response(JSON.stringify({ checked: containers?.length ?? 0, sent: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
