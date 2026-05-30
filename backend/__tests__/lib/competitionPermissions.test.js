'use strict';

const {
  canRefereeCompetition,
  canManageCompetition,
  isValidRefereeAccessToken,
} = require('../../lib/competitionPermissions');

describe('competitionPermissions — árbitro por enlace', () => {
  const organizer = { id: 'org-1', email: 'org@test.com' };
  const other = { id: 'user-2', email: 'member@test.com' };
  const competition = {
    organizer: 'org-1',
    referee_access_token: 'abc123secret',
  };

  describe('isValidRefereeAccessToken', () => {
    it('acepta token coincidente', () => {
      expect(isValidRefereeAccessToken(competition, 'abc123secret')).toBe(true);
    });

    it('rechaza token incorrecto o vacío', () => {
      expect(isValidRefereeAccessToken(competition, 'wrong')).toBe(false);
      expect(isValidRefereeAccessToken(competition, '')).toBe(false);
      expect(isValidRefereeAccessToken({ referee_access_token: null }, 'abc')).toBe(false);
    });
  });

  describe('canRefereeCompetition', () => {
    it('organizador puede arbitrar sin token', () => {
      expect(canRefereeCompetition(organizer, competition)).toBe(true);
    });

    it('miembro del club sin token no puede arbitrar', () => {
      expect(canRefereeCompetition(other, competition)).toBe(false);
    });

    it('usuario anónimo con token válido puede arbitrar', () => {
      expect(canRefereeCompetition(null, competition, 'abc123secret')).toBe(true);
    });

    it('token inválido no concede acceso', () => {
      expect(canRefereeCompetition(null, competition, 'invalid')).toBe(false);
    });
  });

  describe('canManageCompetition', () => {
    it('miembro del club no obtiene gestión completa', () => {
      expect(canManageCompetition(other, competition)).toBe(false);
    });

    it('organizador sí gestiona', () => {
      expect(canManageCompetition(organizer, competition)).toBe(true);
    });
  });
});
