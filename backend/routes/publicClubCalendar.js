/**
 * Calendario iCal público del club (token en query).
 */
const express = require('express');
const { param, query } = require('express-validator');
const { getServiceClient } = require('../lib/supabaseClients');
const { buildClubEventsIcs } = require('../lib/clubIcs');
const { handleValidationErrors } = require('../middleware/validateRequest');

const router = express.Router();
const supabaseAdmin = getServiceClient();

function getFrontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

router.get(
  '/:clubId/calendar.ics',
  param('clubId').isUUID(),
  query('token').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { clubId } = req.params;
      const token = String(req.query.token || '').trim();

      const { data: club, error: cErr } = await supabaseAdmin
        .from('clubs')
        .select('id, calendar_feed_token')
        .eq('id', clubId)
        .maybeSingle();
      if (cErr || !club) return res.status(404).send('Not found');
      if (!club.calendar_feed_token || club.calendar_feed_token !== token) {
        return res.status(404).send('Not found');
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: events, error: eErr } = await supabaseAdmin
        .from('club_events')
        .select('id, title, description, event_date, location, competition_id, competitions ( public_slug )')
        .eq('club_id', clubId)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .order('created_at', { ascending: true });

      if (eErr) {
        console.error('public calendar.ics', eErr);
        return res.status(500).send('Error');
      }

      const ics = buildClubEventsIcs(events || [], {
        signupBaseUrl: getFrontendBase(),
        uidDomain: process.env.ICS_UID_DOMAIN || 'slotdatabase.app',
      });

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.send(ics);
    } catch (e) {
      console.error('GET calendar.ics', e);
      res.status(500).send('Error');
    }
  },
);

module.exports = router;
