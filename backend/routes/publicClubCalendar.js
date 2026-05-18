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

/** Mismos campos seguros que GET /clubs/:id/board (sin document_storage_path). */
const CLUB_BOARD_PROFILE_SELECT =
  'id, club_id, user_id, title, body, link_url, link_label, document_url, document_label, pinned, sort_order, is_public, created_at, updated_at';

function getFrontendBase() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
}

router.get(
  '/by-slug/:slug/profile',
  param('slug').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(503).json({ error: 'Servicio no configurado' });
      }
      const slug = String(req.params.slug || '').trim();
      const { data: club, error: cErr } = await supabaseAdmin
        .from('clubs')
        .select('id, name, slug, description, city, website_url')
        .eq('slug', slug)
        .maybeSingle();
      if (cErr || !club) {
        return res.status(404).json({ error: 'Club no encontrado' });
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const { data: events, error: eErr } = await supabaseAdmin
        .from('club_events')
        .select(
          'id, title, description, event_date, start_time, end_time, location, competition_id, competitions ( public_slug )',
        )
        .eq('club_id', club.id)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true })
        .limit(5);

      if (eErr) {
        console.error('public club profile events', eErr);
        return res.status(500).json({ error: 'Error al cargar eventos' });
      }

      const { data: boardItems, error: bErr } = await supabaseAdmin
        .from('club_board_items')
        .select(CLUB_BOARD_PROFILE_SELECT)
        .eq('club_id', club.id)
        .eq('is_public', true)
        .order('pinned', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (bErr) {
        console.error('public club profile board', bErr);
        return res.status(500).json({ error: 'Error al cargar el tablón público' });
      }

      res.json({
        club: {
          name: club.name,
          slug: club.slug,
          description: club.description,
          city: club.city,
          website_url: club.website_url,
        },
        upcoming_events: events || [],
        board_items: boardItems || [],
      });
    } catch (e) {
      console.error('GET by-slug profile', e);
      res.status(500).json({ error: e.message });
    }
  },
);

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
        .select(
          'id, title, description, event_date, start_time, end_time, location, competition_id, competitions ( public_slug )',
        )
        .eq('club_id', clubId)
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true, nullsFirst: true })
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
