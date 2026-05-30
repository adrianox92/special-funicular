'use strict';

const express = require('express');
const { param } = require('express-validator');
const router = express.Router();
const { getServiceOrAnonClient } = require('../lib/supabaseClients');
const { handleValidationErrors } = require('../middleware/validateRequest');
const { requireRefereeByToken } = require('../lib/competitionPermissions');
const {
  listCompetitionTimings,
  listCompetitionParticipants,
  createCompetitionTiming,
  updateCompetitionTiming,
  updateCompetitionTimingPenalty,
  toPublicRefereeCompetition,
  sendHandlerError,
} = require('../lib/competitionTimingHandlers');

const supabase = getServiceOrAnonClient();

router.get(
  '/:token',
  param('token').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireRefereeByToken(supabase, req.params.token);
      if (!access.ok) return access.respond(res);
      res.json(toPublicRefereeCompetition(access.competition));
    } catch (e) {
      console.error('GET /api/referee/:token', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.get(
  '/:token/participants',
  param('token').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireRefereeByToken(supabase, req.params.token);
      if (!access.ok) return access.respond(res);
      const result = await listCompetitionParticipants(supabase, access.competition.id);
      if (result.error) return sendHandlerError(res, result.error);
      res.json(result.data);
    } catch (e) {
      console.error('GET /api/referee/:token/participants', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.get(
  '/:token/timings',
  param('token').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireRefereeByToken(supabase, req.params.token);
      if (!access.ok) return access.respond(res);
      const result = await listCompetitionTimings(supabase, access.competition.id, req.query);
      if (result.error) return sendHandlerError(res, result.error);
      res.json(result.data);
    } catch (e) {
      console.error('GET /api/referee/:token/timings', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.post(
  '/:token/timings',
  param('token').trim().notEmpty(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireRefereeByToken(
        supabase,
        req.params.token,
        'id, name, rounds, circuit_id, status, organizer, referee_access_token',
      );
      if (!access.ok) return access.respond(res);
      const result = await createCompetitionTiming(
        supabase,
        access.competition.id,
        access.competition,
        req.body,
      );
      if (result.error) return sendHandlerError(res, result.error);
      res.status(result.status || 201).json(result.data);
    } catch (e) {
      console.error('POST /api/referee/:token/timings', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.put(
  '/:token/timings/:timingId',
  param('token').trim().notEmpty(),
  param('timingId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const access = await requireRefereeByToken(
        supabase,
        req.params.token,
        'id, name, rounds, circuit_id, status, organizer, referee_access_token',
      );
      if (!access.ok) return access.respond(res);
      const result = await updateCompetitionTiming(
        supabase,
        access.competition.id,
        access.competition,
        req.params.timingId,
        req.body,
      );
      if (result.error) return sendHandlerError(res, result.error);
      res.json(result.data);
    } catch (e) {
      console.error('PUT /api/referee/:token/timings/:timingId', e);
      res.status(500).json({ error: e.message });
    }
  },
);

router.patch(
  '/:token/timings/:timingId/penalty',
  param('token').trim().notEmpty(),
  param('timingId').isUUID(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { penalty_seconds } = req.body;
      if (typeof penalty_seconds !== 'number' || penalty_seconds < 0) {
        return res.status(400).json({ error: 'penalty_seconds debe ser un número positivo' });
      }
      const access = await requireRefereeByToken(supabase, req.params.token);
      if (!access.ok) return access.respond(res);
      const result = await updateCompetitionTimingPenalty(
        supabase,
        access.competition.id,
        req.params.timingId,
        penalty_seconds,
      );
      if (result.error) return sendHandlerError(res, result.error);
      res.json({ success: true });
    } catch (e) {
      console.error('PATCH /api/referee/:token/timings/:timingId/penalty', e);
      res.status(500).json({ error: e.message });
    }
  },
);

module.exports = router;
