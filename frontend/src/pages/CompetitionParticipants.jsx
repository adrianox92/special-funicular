import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Users, Trash2, Pencil, ArrowLeft, Check, X, Trophy, AlertTriangle, Clock, Tags, Link2, Star, Plus, ArrowUp, ArrowDown, Calendar, Flag } from 'lucide-react';
import axios from '../lib/axios';
import CompetitionSignups from '../components/CompetitionSignups';
import CompetitionCategories from '../components/CompetitionCategories';
import CompetitionRulesPanel from '../components/CompetitionRulesPanel';
import CompetitionRoundStages from './CompetitionRoundStages';
import CompetitionStatusBadge from '../components/CompetitionStatusBadge';
import LiveEventHubLinks from '../components/LiveEventHubLinks';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tabs, TabsContent } from '../components/ui/tabs';
import { ResponsiveTabsNav } from '../components/ui/responsive-tabs-nav';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Spinner } from '../components/ui/spinner';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { isLicenseAdminUser } from '../lib/licenseAdmin';
import CollectionVehiclePicker from '../components/CollectionVehiclePicker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

import { competitionDetailPath } from '../utils/competitionRoutes';

const SETUP_TABS = new Set(['participants', 'signups', 'stages', 'categories', 'rules']);

const DATE_LOCALE_BY_LANG = { es: 'es-ES', en: 'en-US', de: 'de-DE' };

function formatCompetitionDate(dateString, language) {
  if (!dateString) return '';
  const lang = language?.split('-')[0] || 'es';
  const locale = DATE_LOCALE_BY_LANG[lang] || 'es-ES';
  return new Date(dateString).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCompetitionProgressStatus(competition, participantsCount, timingsCount, t) {
  const status = competition?.status || 'published';
  const slotCap = competition?.num_slots ?? 0;
  const isFull = slotCap > 0 && participantsCount >= slotCap;
  const maxTimings = participantsCount * (competition?.rounds || 0);
  const allTimingsComplete = maxTimings > 0 && timingsCount >= maxTimings;

  if (status === 'draft') {
    return { label: t('manage.progressStatus.draft'), variant: 'outline' };
  }
  if (status === 'closed') {
    return { label: t('manage.progressStatus.closed'), variant: 'destructive' };
  }
  if (isFull && allTimingsComplete) {
    return { label: t('manage.progressStatus.complete'), variant: 'default' };
  }
  if (status === 'running') {
    return { label: t('manage.progressStatus.running'), variant: 'secondary' };
  }
  if (status === 'published') {
    return { label: t('manage.progressStatus.registrationOpen'), variant: 'secondary' };
  }
  return { label: status, variant: 'outline' };
}

const CompetitionParticipants = ({ embedded = false, onCompetitionChange }) => {
  const { id: competitionId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t, i18n } = useTranslation('competitions');
  const { t: tCommon } = useTranslation('common');

  const [competition, setCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const tabFromUrl = searchParams.get('tab');
  const [localTab, setLocalTab] = useState('participants');

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    vehicle_id: '',
    driver_name: '',
    vehicle_model: '',
    category_id: ''
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState(null);
  const [participantType, setParticipantType] = useState('own');
  const [selectedFavoriteId, setSelectedFavoriteId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, participantId: null });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState(null);
  const [editForm, setEditForm] = useState({
    vehicle_id: '',
    driver_name: '',
    vehicle_model: '',
    category_id: ''
  });
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(null);

  const [memberSignupForm, setMemberSignupForm] = useState({
    category_id: '',
    vehicle: '',
    vehicle_id: '',
    name: '',
  });
  const [memberVehicleSource, setMemberVehicleSource] = useState('own');
  const [memberSignupLoading, setMemberSignupLoading] = useState(false);

  const [favorites, setFavorites] = useState([]);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [favoritesSelection, setFavoritesSelection] = useState({});
  const [favoritesCategoryId, setFavoritesCategoryId] = useState('');
  const [guestMembers, setGuestMembers] = useState([]);
  const [showGuestsModal, setShowGuestsModal] = useState(false);
  const [guestsSelection, setGuestsSelection] = useState({});
  const [guestsCategoryId, setGuestsCategoryId] = useState('');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState(null);
  const [startOrderSavingId, setStartOrderSavingId] = useState(null);
  const [startOrderDraft, setStartOrderDraft] = useState({});

  const canUseOrganizerTools = Boolean(
    (user?.id && competition?.organizer === user.id) || isLicenseAdminUser(user),
  );
  const showStagesTab = Boolean(canUseOrganizerTools && competition?.is_multi_stage);
  const showRoundLapsTab = Boolean(
    canUseOrganizerTools &&
      !competition?.is_multi_stage &&
      (competition?.rounds ?? 0) > 1,
  );
  const showRoundConfigTab = showStagesTab || showRoundLapsTab;
  const participantTabOptions = useMemo(() => {
    const waitlistSuffix =
      competition?.waitlist_count > 0
        ? t('manage.tabs.waitlistSuffix', { count: competition.waitlist_count })
        : '';
    const participantsTabLabel = t('manage.tabs.participantsCount', { count: participants.length });
    const signupsTabLabel =
      t('manage.tabs.signupsCount', { count: competition?.signups_count || 0 }) + waitlistSuffix;
    const stagesTabLabel = showStagesTab ? t('manage.tabs.stages') : t('manage.tabs.roundLaps');
    const categoriesTabLabel = t('manage.tabs.categoriesCount', {
      count: competition?.categories?.length || 0,
    });
    const rulesTabLabel = t('manage.tabs.rules');
    return [
      {
        value: 'participants',
        label: participantsTabLabel,
        trigger: (
          <>
            <Users className="size-4" />
            {participantsTabLabel}
          </>
        ),
      },
      ...(canUseOrganizerTools
        ? [
            {
              value: 'signups',
              label: signupsTabLabel,
              trigger: (
                <>
                  <Users className="size-4" />
                  {signupsTabLabel}
                </>
              ),
            },
          ]
        : []),
      ...(showRoundConfigTab
        ? [
            {
              value: 'stages',
              label: stagesTabLabel,
              trigger: (
                <>
                  <Flag className="size-4" />
                  {stagesTabLabel}
                </>
              ),
            },
          ]
        : []),
      {
        value: 'categories',
        label: categoriesTabLabel,
        trigger: (
          <>
            <Tags className="size-4" />
            {categoriesTabLabel}
          </>
        ),
      },
      {
        value: 'rules',
        label: rulesTabLabel,
        trigger: (
          <>
            <Trophy className="size-4" />
            {rulesTabLabel}
          </>
        ),
      },
    ];
  }, [
    canUseOrganizerTools,
    showRoundConfigTab,
    showStagesTab,
    participants.length,
    competition?.signups_count,
    competition?.waitlist_count,
    competition?.categories?.length,
    t,
  ]);
  const effectiveCompetitionStatus = competition?.status || 'published';
  const registrationDeadlineExpired = Boolean(
    competition?.registration_deadline &&
      new Date() > new Date(competition.registration_deadline),
  );
  const memberSignupBlocked =
    effectiveCompetitionStatus !== 'published' || registrationDeadlineExpired;
  const participantsFull = competition
    ? participants.length >= (competition.num_slots ?? 0)
    : false;

  const activeTab = useMemo(() => {
    const raw = embedded ? tabFromUrl : localTab;
    if (!SETUP_TABS.has(raw)) return 'participants';
    if (raw === 'signups' && !canUseOrganizerTools) return 'participants';
    if (raw === 'stages' && !showRoundConfigTab) return 'participants';
    return raw;
  }, [embedded, tabFromUrl, localTab, canUseOrganizerTools, showRoundConfigTab]);

  const onTabChange = useCallback(
    (value) => {
      if (embedded) {
        setSearchParams({ section: 'setup', tab: value }, { replace: true });
      } else {
        setLocalTab(value);
      }
    },
    [embedded, setSearchParams],
  );

  const loadCompetition = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/competitions/${competitionId}`);
      setCompetition(response.data);
      setParticipants(response.data.participants || []);
      setStartOrderDraft({});
      setError(null);
    } catch (err) {
      console.error('Error al cargar competición:', err);
      setError(t('detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [competitionId, t]);

  const loadFavorites = useCallback(async (organizerId) => {
    if (!organizerId) return;
    try {
      const response = await axios.get('/favorite-pilots', {
        params: { owner_user_id: organizerId },
      });
      setFavorites(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
    }
  }, []);

  const loadGuestMembers = useCallback(async (clubId) => {
    if (!clubId) {
      setGuestMembers([]);
      return;
    }
    try {
      const response = await axios.get(`/clubs/${clubId}/guest-members`);
      setGuestMembers(Array.isArray(response.data?.guest_members) ? response.data.guest_members : []);
    } catch (err) {
      console.error('Error al cargar miembros invitados:', err);
      setGuestMembers([]);
    }
  }, []);

  const loadVehicles = useCallback(async (garageUserId) => {
    try {
      const response = await axios.get('/competitions/vehicles', {
        params: garageUserId ? { garage_user_id: garageUserId } : undefined,
      });
      setVehicles(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error al cargar vehículos:', err);
      setVehicles([]);
    }
  }, []);

  useEffect(() => {
    loadCompetition();
  }, [loadCompetition]);

  useEffect(() => {
    if (!competition?.organizer || !user?.id) return;
    const isOrganizerOrAdmin =
      competition.organizer === user.id || isLicenseAdminUser(user);
    if (isOrganizerOrAdmin) {
      // Organizador: garaje propio (o el del organizador si es admin de licencia).
      loadVehicles(competition.organizer);
      loadFavorites(competition.organizer);
      if (competition.club_id) {
        loadGuestMembers(competition.club_id);
      } else {
        setGuestMembers([]);
      }
    } else {
      // Miembro: su propia colección para inscribirse.
      loadVehicles();
    }
  }, [competition?.organizer, competition?.club_id, user, loadVehicles, loadFavorites, loadGuestMembers]);

  const eligibleGuestMembers = useMemo(
    () => (guestMembers || []).filter((guest) => !guest.linked_user_id),
    [guestMembers],
  );

  const handleAddParticipant = useCallback(async (e) => {
    e.preventDefault();
    if (!addForm.category_id) {
      setAddError(t('manage.errors.selectCategory'));
      return;
    }

    if (participantType === 'favorite') {
      if (!selectedFavoriteId) {
        setAddError(t('manage.errors.selectFavorite'));
        return;
      }
      const fav = favorites.find((f) => f.id === selectedFavoriteId);
      if (!fav) {
        setAddError(t('manage.errors.favoriteNotFound'));
        return;
      }
      const hasDefault = !!fav.default_vehicle_id || !!fav.default_vehicle_model;
      const vehicleSource = addForm.vehicle_id
        ? 'own'
        : addForm.vehicle_model.trim()
          ? 'text'
          : hasDefault
            ? 'favorite_default'
            : null;
      if (!vehicleSource) {
        setAddError(t('manage.errors.favoriteNoDefaultVehicle'));
        return;
      }
      try {
        setAdding(true);
        setAddError(null);
        const item = {
          favorite_id: selectedFavoriteId,
          category_id: addForm.category_id,
          vehicle_source: vehicleSource,
        };
        if (vehicleSource === 'own') item.vehicle_id = addForm.vehicle_id;
        if (vehicleSource === 'text') item.vehicle_model = addForm.vehicle_model.trim();
        const response = await axios.post(
          `/competitions/${competitionId}/participants/bulk-from-favorites`,
          { items: [item] },
        );
        const created = response.data?.created?.length || 0;
        const skipped = response.data?.skipped || [];
        if (created > 0) {
          toast.success(t('manage.toasts.favoriteAdded'));
        } else if (skipped.length > 0) {
          setAddError(skipped[0].reason || t('manage.errors.favoriteAddFailed'));
          return;
        }
        setShowAddModal(false);
        setAddForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
        setParticipantType('own');
        setSelectedFavoriteId('');
        loadCompetition();
      } catch (err) {
        console.error('Error al añadir favorito:', err);
        setAddError(err.response?.data?.error || t('manage.errors.addFavoriteFailed'));
      } finally {
        setAdding(false);
      }
      return;
    }

    if (participantType === 'club_guest') {
      if (!selectedGuestId) {
        setAddError(t('guestMembers.selectGuestRequired'));
        return;
      }
      const guest = eligibleGuestMembers.find((g) => g.id === selectedGuestId);
      if (!guest) {
        setAddError(t('guestMembers.selectGuestRequired'));
        return;
      }
      const vehicleSource = addForm.vehicle_id ? 'own' : addForm.vehicle_model.trim() ? 'text' : null;
      if (!vehicleSource) {
        setAddError(t('guestMembers.vehicleRequired'));
        return;
      }
      try {
        setAdding(true);
        setAddError(null);
        const item = {
          guest_member_id: selectedGuestId,
          category_id: addForm.category_id,
          vehicle_source: vehicleSource,
        };
        if (vehicleSource === 'own') item.vehicle_id = addForm.vehicle_id;
        if (vehicleSource === 'text') item.vehicle_model = addForm.vehicle_model.trim();
        const response = await axios.post(
          `/competitions/${competitionId}/participants/bulk-from-guest-members`,
          { items: [item] },
        );
        const created = response.data?.created?.length || 0;
        const skipped = response.data?.skipped || [];
        if (created > 0) {
          toast.success(t('guestMembers.addedSuccess'));
        } else if (skipped.length > 0) {
          setAddError(skipped[0].reason || t('guestMembers.bulkSkippedWarning', { count: 1 }));
          return;
        }
        setShowAddModal(false);
        setAddForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
        setParticipantType('own');
        setSelectedGuestId('');
        loadCompetition();
      } catch (err) {
        console.error('Error al añadir miembro invitado:', err);
        setAddError(err.response?.data?.error || t('guestMembers.createBulkError'));
      } finally {
        setAdding(false);
      }
      return;
    }

    if (!addForm.driver_name.trim()) {
      setAddError(t('manage.errors.driverNameRequired'));
      return;
    }
    if (participantType === 'own' && !addForm.vehicle_id) {
      setAddError(t('manage.errors.selectVehicle'));
      return;
    }
    if (participantType === 'external' && !addForm.vehicle_model.trim()) {
      setAddError(t('manage.errors.vehicleModelRequired'));
      return;
    }
    try {
      setAdding(true);
      setAddError(null);
      const participantData = {
        driver_name: addForm.driver_name.trim(),
        category_id: addForm.category_id
      };
      if (participantType === 'own') {
        participantData.vehicle_id = addForm.vehicle_id;
      } else {
        participantData.vehicle_model = addForm.vehicle_model.trim();
      }
      await axios.post(`/competitions/${competitionId}/participants`, participantData);
      setShowAddModal(false);
      setAddForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
      setParticipantType('own');
      setSelectedFavoriteId('');
      loadCompetition();
    } catch (err) {
      console.error('Error al añadir participante:', err);
      setAddError(err.response?.data?.error || t('manage.errors.addParticipantFailed'));
    } finally {
      setAdding(false);
    }
  }, [addForm, participantType, selectedFavoriteId, selectedGuestId, favorites, eligibleGuestMembers, competitionId, loadCompetition, t]);

  const handleEditParticipant = useCallback(async (e) => {
    e.preventDefault();
    if (!editForm.driver_name.trim()) {
      setEditError(t('manage.errors.driverNameRequired'));
      return;
    }
    if (!editForm.category_id) {
      setEditError(t('manage.errors.selectCategory'));
      return;
    }
    try {
      setEditing(true);
      setEditError(null);
      const participantData = {
        driver_name: editForm.driver_name.trim(),
        category_id: editForm.category_id
      };
      if (editForm.vehicle_id) {
        participantData.vehicle_id = editForm.vehicle_id;
      } else if (editForm.vehicle_model) {
        participantData.vehicle_model = editForm.vehicle_model.trim();
      }
      await axios.put(`/competitions/${competitionId}/participants/${editingParticipant.id}`, participantData);
      setShowEditModal(false);
      setEditingParticipant(null);
      setEditForm({ vehicle_id: '', driver_name: '', vehicle_model: '', category_id: '' });
      loadCompetition();
    } catch (err) {
      console.error('Error al editar participante:', err);
      setEditError(err.response?.data?.error || t('manage.errors.editParticipantFailed'));
    } finally {
      setEditing(false);
    }
  }, [editForm, editingParticipant, competitionId, loadCompetition, t]);

  const openEditModal = useCallback((participant) => {
    setEditingParticipant(participant);
    setEditForm({
      vehicle_id: participant.vehicle_id || '',
      driver_name: participant.driver_name,
      vehicle_model: participant.vehicle_model || '',
      category_id: participant.category_id || ''
    });
    setShowEditModal(true);
  }, []);

  const handleDeleteParticipant = useCallback((participantId) => {
    setDeleteConfirm({ open: true, participantId });
  }, []);

  const handleMemberSignup = useCallback(
    async (e) => {
      e.preventDefault();
      if (!memberSignupForm.category_id) {
        toast.error(t('manage.memberSignup.selectCategoryError'));
        return;
      }
      if (memberVehicleSource === 'own' && !memberSignupForm.vehicle_id) {
        toast.error(t('manage.memberSignup.selectVehicleError'));
        return;
      }
      if (memberVehicleSource === 'text' && !memberSignupForm.vehicle?.trim()) {
        toast.error(t('manage.memberSignup.enterVehicleError'));
        return;
      }
      try {
        setMemberSignupLoading(true);
        const payload = {
          category_id: memberSignupForm.category_id,
          ...(memberSignupForm.name?.trim() ? { name: memberSignupForm.name.trim() } : {}),
        };
        if (memberVehicleSource === 'own') {
          payload.vehicle_id = memberSignupForm.vehicle_id;
        } else {
          payload.vehicle = memberSignupForm.vehicle.trim();
        }
        const res = await axios.post(`/competitions/${competitionId}/signups`, payload);
        if (res.data?.waitlisted) {
          toast.success(
            t('manage.memberSignup.waitlistSuccess', {
              position: res.data.waitlist_position ?? '—',
            }),
          );
        } else {
          toast.success(t('manage.memberSignup.submittedSuccess'));
        }
        setMemberSignupForm({ category_id: '', vehicle: '', vehicle_id: '', name: '' });
        setMemberVehicleSource('own');
        loadCompetition();
      } catch (err) {
        toast.error(err.response?.data?.error || t('manage.memberSignup.submitError'));
      } finally {
        setMemberSignupLoading(false);
      }
    },
    [competitionId, memberSignupForm, memberVehicleSource, loadCompetition, t],
  );

  const usedFavoriteIds = useMemo(() => {
    const set = new Set();
    (participants || []).forEach((p) => {
      if (p.from_favorite_id) set.add(p.from_favorite_id);
    });
    return set;
  }, [participants]);

  const usedGuestMemberIds = useMemo(() => {
    const set = new Set();
    (participants || []).forEach((p) => {
      if (p.from_guest_member_id) set.add(p.from_guest_member_id);
    });
    return set;
  }, [participants]);

  const openFavoritesModal = useCallback(() => {
    const defaultCat = competition?.categories?.[0]?.id || '';
    setFavoritesCategoryId(defaultCat ? String(defaultCat) : '');
    const sel = {};
    (favorites || []).forEach((fav) => {
      if (!usedFavoriteIds.has(fav.id)) {
        sel[fav.id] = {
          checked: false,
          vehicle_source:
            fav.default_vehicle_id || fav.default_vehicle_model ? 'favorite_default' : 'text',
          vehicle_id: '',
          vehicle_model: '',
        };
      }
    });
    setFavoritesSelection(sel);
    setBulkError(null);
    setShowFavoritesModal(true);
  }, [competition?.categories, favorites, usedFavoriteIds]);

  const toggleFavoriteCheck = useCallback((favId) => {
    setFavoritesSelection((prev) => ({
      ...prev,
      [favId]: { ...prev[favId], checked: !prev[favId]?.checked },
    }));
  }, []);

  const updateFavoriteBulkRow = useCallback((favId, patch) => {
    setFavoritesSelection((prev) => ({
      ...prev,
      [favId]: { ...prev[favId], ...patch },
    }));
  }, []);

  const handleBulkAddFromFavorites = useCallback(async () => {
    const items = [];
    for (const [favId, cfg] of Object.entries(favoritesSelection)) {
      if (!cfg?.checked) continue;
      items.push({
        favorite_id: favId,
        category_id: favoritesCategoryId,
        vehicle_source: cfg.vehicle_source,
        vehicle_id: cfg.vehicle_source === 'own' ? cfg.vehicle_id : undefined,
        vehicle_model: cfg.vehicle_source === 'text' ? cfg.vehicle_model : undefined,
      });
    }
    if (items.length === 0) {
      setBulkError(t('manage.errors.selectAtLeastOneFavorite'));
      return;
    }
    if (!favoritesCategoryId) {
      setBulkError(t('manage.errors.selectCategoryForNew'));
      return;
    }
    try {
      setBulkSaving(true);
      setBulkError(null);
      const response = await axios.post(
        `/competitions/${competitionId}/participants/bulk-from-favorites`,
        { items },
      );
      const created = response.data?.created?.length || 0;
      const skipped = response.data?.skipped || [];
      if (created > 0) {
        toast.success(t('manage.toasts.participantsAdded', { count: created }));
      }
      if (skipped.length > 0) {
        toast.warning(t('manage.toasts.bulkSkipped', { count: skipped.length }));
      }
      setShowFavoritesModal(false);
      loadCompetition();
    } catch (err) {
      console.error('Error alta masiva favoritos:', err);
      setBulkError(err.response?.data?.error || t('manage.errors.bulkFavoritesFailed'));
    } finally {
      setBulkSaving(false);
    }
  }, [competitionId, favoritesSelection, favoritesCategoryId, loadCompetition, t]);

  const openGuestsModal = useCallback(() => {
    const defaultCat = competition?.categories?.[0]?.id || '';
    setGuestsCategoryId(defaultCat ? String(defaultCat) : '');
    const sel = {};
    (eligibleGuestMembers || []).forEach((guest) => {
      if (!usedGuestMemberIds.has(guest.id)) {
        sel[guest.id] = {
          checked: false,
          vehicle_source: 'text',
          vehicle_id: '',
          vehicle_model: '',
        };
      }
    });
    setGuestsSelection(sel);
    setBulkError(null);
    setShowGuestsModal(true);
  }, [competition?.categories, eligibleGuestMembers, usedGuestMemberIds]);

  const toggleGuestCheck = useCallback((guestId) => {
    setGuestsSelection((prev) => ({
      ...prev,
      [guestId]: { ...prev[guestId], checked: !prev[guestId]?.checked },
    }));
  }, []);

  const updateGuestBulkRow = useCallback((guestId, patch) => {
    setGuestsSelection((prev) => ({
      ...prev,
      [guestId]: { ...prev[guestId], ...patch },
    }));
  }, []);

  const handleBulkAddFromGuests = useCallback(async () => {
    const items = [];
    for (const [guestId, cfg] of Object.entries(guestsSelection)) {
      if (!cfg?.checked) continue;
      items.push({
        guest_member_id: guestId,
        category_id: guestsCategoryId,
        vehicle_source: cfg.vehicle_source,
        vehicle_id: cfg.vehicle_source === 'own' ? cfg.vehicle_id : undefined,
        vehicle_model: cfg.vehicle_source === 'text' ? cfg.vehicle_model : undefined,
      });
    }
    if (items.length === 0) {
      setBulkError(t('guestMembers.selectAtLeastOne'));
      return;
    }
    if (!guestsCategoryId) {
      setBulkError(t('guestMembers.selectCategory'));
      return;
    }
    try {
      setBulkSaving(true);
      setBulkError(null);
      const response = await axios.post(
        `/competitions/${competitionId}/participants/bulk-from-guest-members`,
        { items },
      );
      const created = response.data?.created?.length || 0;
      const skipped = response.data?.skipped || [];
      if (created > 0) {
        toast.success(t('guestMembers.bulkAddedSuccess', { count: created }));
      }
      if (skipped.length > 0) {
        toast.warning(t('guestMembers.bulkSkippedWarning', { count: skipped.length }));
      }
      setShowGuestsModal(false);
      loadCompetition();
    } catch (err) {
      console.error('Error alta masiva miembros invitados:', err);
      setBulkError(err.response?.data?.error || t('guestMembers.createBulkError'));
    } finally {
      setBulkSaving(false);
    }
  }, [competitionId, guestsSelection, guestsCategoryId, loadCompetition, t]);

  const confirmDeleteParticipant = useCallback(async () => {
    if (!deleteConfirm.participantId) return;
    try {
      await axios.delete(`/competitions/${competitionId}/participants/${deleteConfirm.participantId}`);
      setDeleteConfirm({ open: false, participantId: null });
      loadCompetition();
    } catch (err) {
      console.error('Error al eliminar participante:', err);
      toast.error(t('manage.errors.deleteParticipantFailed'));
    }
  }, [competitionId, loadCompetition, deleteConfirm.participantId, t]);

  const getVehicleInfo = useCallback((participant) => {
    if (participant.vehicle_id && participant.vehicles) {
      return { model: participant.vehicles.model, manufacturer: participant.vehicles.manufacturer, type: 'own' };
    }
    if (participant.vehicle_model) {
      return { model: participant.vehicle_model, manufacturer: t('manage.externalVehicle'), type: 'external' };
    }
    return null;
  }, [t]);

  const getCategoryName = useCallback((categoryId) => {
    if (!competition?.categories) return t('manage.noCategory');
    const category = competition.categories.find(cat => cat.id === categoryId);
    return category ? category.name : t('manage.noCategory');
  }, [competition?.categories, t]);

  const sortedParticipants = useMemo(() => {
    return [...(participants || [])].sort((a, b) => {
      const ao = a.start_order;
      const bo = b.start_order;
      if (ao != null && bo != null) return ao - bo;
      if (ao != null) return -1;
      if (bo != null) return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [participants]);

  const saveStartOrder = useCallback(async (participantId, value) => {
    const trimmed = String(value ?? '').trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed != null && (!Number.isFinite(parsed) || parsed < 1)) {
      toast.error(t('manage.errors.startOrderInvalid'));
      return;
    }
    try {
      setStartOrderSavingId(participantId);
      await axios.put(`/competitions/${competitionId}/participants/${participantId}`, {
        driver_name: participants.find((p) => p.id === participantId)?.driver_name,
        category_id: participants.find((p) => p.id === participantId)?.category_id,
        ...(participants.find((p) => p.id === participantId)?.vehicle_id
          ? { vehicle_id: participants.find((p) => p.id === participantId)?.vehicle_id }
          : { vehicle_model: participants.find((p) => p.id === participantId)?.vehicle_model }),
        start_order: parsed,
      });
      await loadCompetition();
      setStartOrderDraft((prev) => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
    } catch (err) {
      toast.error(err.response?.data?.error || t('manage.errors.startOrderSaveFailed'));
      setStartOrderDraft((prev) => {
        const next = { ...prev };
        delete next[participantId];
        return next;
      });
      await loadCompetition();
    } finally {
      setStartOrderSavingId(null);
    }
  }, [competitionId, participants, loadCompetition, t]);

  const moveParticipantOrder = useCallback(async (participantId, direction) => {
    const list = [...sortedParticipants];
    const idx = list.findIndex((p) => p.id === participantId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= list.length) return;

    [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];

    try {
      setStartOrderSavingId(participantId);
      await axios.put(`/competitions/${competitionId}/participants/reorder`, {
        ordered_ids: list.map((p) => p.id),
      });
      setStartOrderDraft({});
      await loadCompetition();
    } catch (err) {
      toast.error(err.response?.data?.error || t('manage.errors.reorderFailed'));
    } finally {
      setStartOrderSavingId(null);
    }
  }, [competitionId, sortedParticipants, loadCompetition, t]);

  const patchCompetitionStatus = useCallback(
    async (status) => {
      try {
        await axios.patch(`/competitions/${competitionId}/status`, { status });
        toast.success(t('detail.statusUpdated'));
        await loadCompetition();
        onCompetitionChange?.();
      } catch (err) {
        toast.error(err.response?.data?.error || t('detail.statusUpdateError'));
      }
    },
    [competitionId, loadCompetition, onCompetitionChange, t],
  );

  const generatePublicLink = () => {
    if (competition?.public_slug && competition.categories && competition.categories.length > 0) {
      return `${window.location.origin}/competitions/signup/${competition.public_slug}`;
    }
    return null;
  };

  const generateStatusLink = () => {
    if (competition?.public_slug) {
      return `${window.location.origin}/competitions/status/${competition.public_slug}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!competition) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('detail.notFound')}</AlertDescription>
      </Alert>
    );
  }

  const isFull = participants.length >= competition.num_slots;
  const canStartCompetition = participants.length > 0;
  const publicLink = generatePublicLink();
  const statusLink = generateStatusLink();
  const progressPercent = (participants.length / competition.num_slots) * 100;
  const timingsCount = competition.timings_count ?? 0;
  const maxTimings = participants.length * competition.rounds;
  const progressStatus = getCompetitionProgressStatus(competition, participants.length, timingsCount, t);

  return (
    <div className="space-y-6">
      {canUseOrganizerTools && effectiveCompetitionStatus === 'draft' && (
        <Alert>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              <Trans i18nKey="manage.alerts.draftHtml" ns="competitions" components={{ strong: <strong /> }} />
            </span>
            {!embedded && (
              <Button type="button" size="sm" variant="secondary" onClick={() => patchCompetitionStatus('published')}>
                {t('detail.publish')}
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {canUseOrganizerTools &&
        (effectiveCompetitionStatus === 'running' || effectiveCompetitionStatus === 'closed') && (
          <Alert variant={effectiveCompetitionStatus === 'closed' ? 'destructive' : 'default'}>
            <AlertDescription>
              {effectiveCompetitionStatus === 'running'
                ? t('manage.alerts.runningLocked')
                : t('manage.alerts.closedLocked')}
            </AlertDescription>
          </Alert>
        )}
      <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, participantId: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('manage.deleteParticipant.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('manage.deleteParticipant.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('actions.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteParticipant} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('list.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!embedded && (
      <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/competitions')}>
              <ArrowLeft className="size-4 mr-2" />
              {tCommon('actions.back')}
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{competition.name}</h1>
                <CompetitionStatusBadge status={competition.status} />
                {canUseOrganizerTools && (
                  <>
                    {effectiveCompetitionStatus === 'draft' && (
                      <Button type="button" size="sm" variant="secondary" onClick={() => patchCompetitionStatus('published')}>
                        {t('detail.publish')}
                      </Button>
                    )}
                    {effectiveCompetitionStatus === 'published' && (
                      <Button type="button" size="sm" variant="outline" onClick={() => patchCompetitionStatus('draft')}>
                        {t('detail.unpublish')}
                      </Button>
                    )}
                    {effectiveCompetitionStatus === 'running' && (
                      <Button type="button" size="sm" variant="destructive" onClick={() => patchCompetitionStatus('closed')}>
                        {t('detail.close')}
                      </Button>
                    )}
                    {effectiveCompetitionStatus === 'closed' && (
                      <Button type="button" size="sm" variant="outline" onClick={() => patchCompetitionStatus('published')}>
                        {t('detail.reopen')}
                      </Button>
                    )}
                  </>
                )}
                {competition.league && (
                  <Link to={`/leagues/${competition.league.id}`}>
                    <Badge variant="secondary" className="hover:bg-secondary/80">
                      {t('detail.leagueBadge', { name: competition.league.name })}
                    </Badge>
                  </Link>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {canUseOrganizerTools ? t('manage.subtitleOrganizer') : t('manage.subtitleMember')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canUseOrganizerTools && publicLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(publicLink);
                  toast.success(t('manage.linkCopiedToClipboard'));
                }}
                title={t('manage.copySignupLinkTitle')}
              >
                <Link2 className="size-4 mr-2" />
                {t('manage.signupFormButton')}
              </Button>
            )}
            {!canUseOrganizerTools && publicLink && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(publicLink, '_blank', 'noopener,noreferrer');
                }}
              >
                <Link2 className="size-4 mr-2" />
                {t('detail.openSignup')}
              </Button>
            )}
            {canUseOrganizerTools && (
              <Button
                onClick={() => navigate(competitionDetailPath(competitionId, { section: 'timings' }))}
                disabled={!canStartCompetition}
                title={
                  !canStartCompetition
                    ? t('manage.needParticipantForTimings')
                    : t('manage.manageTimingsTitle')
                }
              >
                <Clock className="size-4 mr-2" />
                {t('manage.manageTimings')}
              </Button>
            )}
            {!canUseOrganizerTools && canStartCompetition && (
              <Button variant="outline" size="sm" onClick={() => navigate(competitionDetailPath(competitionId, { section: 'timings' }))}>
                <Clock className="size-4 mr-2" />
                {t('manage.viewTimings')}
              </Button>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Info card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="size-4 text-primary" />
                <strong>{t('manage.stats.participantsLabel')}</strong>
                <Badge variant={isFull ? 'default' : participants.length > 0 ? 'default' : 'secondary'}>
                  {participants.length}/{competition.num_slots}
                </Badge>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                <div
                  className="h-full bg-primary transition-all rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              {isFull && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="size-4" />
                  {t('manage.stats.slotFull')}
                </div>
              )}
              {participants.length > 0 && !isFull && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="size-4" />
                  {t('manage.stats.readyToStart')}
                </div>
              )}
              {participants.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4" />
                  {t('manage.stats.noParticipants')}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="size-4" />
                <strong>{t('manage.stats.statusLabel')}</strong>
                <Badge variant={progressStatus.variant}>{progressStatus.label}</Badge>
              </div>
              {effectiveCompetitionStatus === 'published' && participants.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4" />
                  {t('manage.stats.addAtLeastOne')}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="size-4" />
                <strong>{t('manage.stats.roundsLabel')}</strong>
                <Badge variant="secondary">{competition.rounds}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {t('manage.stats.totalTimings', { current: timingsCount, max: maxTimings })}
              </div>
            </div>
            {competition.registration_deadline && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="size-4" />
                  <strong>{t('manage.stats.registrationUntil')}</strong>
                </div>
                <div
                  className={`text-sm ${registrationDeadlineExpired ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                >
                  {formatCompetitionDate(competition.registration_deadline, i18n.language)}
                  {registrationDeadlineExpired ? t('manage.stats.deadlineClosed') : ''}
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="size-4" />
                <strong>{t('manage.stats.publicLinkLabel')}</strong>
              </div>
              {publicLink ? (
                <span
                  className="text-sm font-medium text-primary break-all cursor-pointer select-all"
                  onClick={() => {
                    navigator.clipboard.writeText(statusLink);
                    toast.success(t('manage.linkCopiedToClipboard'));
                  }}
                  title={t('manage.clickToCopy')}
                >
                  {statusLink}
                </span>
              ) : !competition.public_slug ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="size-4" />
                  {t('manage.stats.notAvailable')}
                </div>
              ) : !competition.categories || competition.categories.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                  {t('manage.stats.noCategories')}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="size-4" />
                  {t('manage.stats.notAvailable')}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {canUseOrganizerTools && competition.public_slug && (
        <LiveEventHubLinks publicSlug={competition.public_slug} />
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={onTabChange}>
        <ResponsiveTabsNav
          value={activeTab}
          onValueChange={onTabChange}
          options={participantTabOptions}
          listClassName="sm:grid-cols-2 lg:grid-cols-5"
          triggerClassName="flex items-center gap-2"
          mobileLabel={t('detail.sectionLabel')}
        />

        <TabsContent value="participants" className="mt-4">
          {!canUseOrganizerTools && (
            <Card className="mb-6 border-primary/30">
              <CardContent className="pt-6 space-y-4">
                <h5 className="font-semibold">{t('manage.memberSignup.title')}</h5>
                <p className="text-sm text-muted-foreground">
                  {t('manage.memberSignup.description')}
                </p>
                <form onSubmit={handleMemberSignup} className="space-y-3 max-w-md">
                  <div className="space-y-2">
                    <Label>{t('manage.memberSignup.category')}</Label>
                    <Select
                      value={memberSignupForm.category_id}
                      onValueChange={(v) => setMemberSignupForm((f) => ({ ...f, category_id: v }))}
                      disabled={memberSignupBlocked || !competition.categories?.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('manage.memberSignup.selectCategory')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(competition.categories || []).map((cat) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('manage.memberSignup.vehicle')}</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="memberVehicleSource"
                          checked={memberVehicleSource === 'own'}
                          onChange={() => setMemberVehicleSource('own')}
                          disabled={memberSignupBlocked}
                          className="rounded-full"
                        />
                        {t('manage.memberSignup.vehicleFromCollection')}
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="memberVehicleSource"
                          checked={memberVehicleSource === 'text'}
                          onChange={() => setMemberVehicleSource('text')}
                          disabled={memberSignupBlocked}
                          className="rounded-full"
                        />
                        {t('manage.memberSignup.vehicleOtherText')}
                      </label>
                    </div>
                    {memberVehicleSource === 'own' ? (
                      vehicles.length > 0 ? (
                        <CollectionVehiclePicker
                          vehicles={vehicles}
                          value={memberSignupForm.vehicle_id}
                          onChange={(v) => setMemberSignupForm((f) => ({ ...f, vehicle_id: v }))}
                          disabled={memberSignupBlocked}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {t('manage.memberSignup.noVehiclesHint')}
                        </p>
                      )
                    ) : (
                      <Input
                        value={memberSignupForm.vehicle}
                        onChange={(e) => setMemberSignupForm((f) => ({ ...f, vehicle: e.target.value }))}
                        placeholder={t('manage.memberSignup.vehiclePlaceholder')}
                        disabled={memberSignupBlocked}
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('manage.memberSignup.trackNameOptional')}</Label>
                    <Input
                      value={memberSignupForm.name}
                      onChange={(e) => setMemberSignupForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder={t('manage.memberSignup.trackNamePlaceholder')}
                      disabled={memberSignupBlocked}
                    />
                  </div>
                  <Button type="submit" disabled={memberSignupLoading || memberSignupBlocked}>
                    {memberSignupLoading
                      ? t('manage.memberSignup.submitting')
                      : memberSignupBlocked
                        ? t('manage.memberSignup.unavailable')
                        : t('manage.memberSignup.submit')}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
            <h5 className="font-semibold">{t('manage.confirmedTitle')}</h5>
            {canUseOrganizerTools && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={openFavoritesModal}
                  disabled={participantsFull || !competition.categories || competition.categories.length === 0 || favorites.length === 0}
                >
                  <Star className="size-4 mr-2" />
                  {t('manage.addFromFavorites')}
                  {favorites.length > 0 && (
                    <Badge variant="secondary" className="ml-2">{favorites.length}</Badge>
                  )}
                </Button>
                {competition.club_id && (
                  <Button
                    variant="outline"
                    onClick={openGuestsModal}
                    disabled={
                      participantsFull
                      || !competition.categories
                      || competition.categories.length === 0
                      || eligibleGuestMembers.length === 0
                    }
                  >
                    <Users className="size-4 mr-2" />
                    {t('guestMembers.addFromClub')}
                    {eligibleGuestMembers.length > 0 && (
                      <Badge variant="secondary" className="ml-2">{eligibleGuestMembers.length}</Badge>
                    )}
                  </Button>
                )}
                <Button
                  onClick={() => setShowAddModal(true)}
                  disabled={participantsFull || !competition.categories || competition.categories.length === 0}
                >
                  <Plus className="size-4 mr-2" />
                  {t('manage.addParticipant')}
                </Button>
              </div>
            )}
          </div>

          {participants.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="size-12 mx-auto text-muted-foreground mb-4" />
                <h4 className="mb-2">{t('manage.empty.title')}</h4>
                <p className="text-muted-foreground mb-6">
                  {canUseOrganizerTools ? t('manage.empty.organizerHint') : t('manage.empty.memberHint')}
                </p>
                {canUseOrganizerTools && (
                  <Button
                    onClick={() => setShowAddModal(true)}
                    disabled={participantsFull || !competition.categories || competition.categories.length === 0}
                  >
                    <span className="mr-2">+</span>
                    {participantsFull ? t('manage.empty.slotFull') : t('manage.empty.addFirst')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>{t('manage.table.startOrder')}</TableHead>
                    <TableHead>{t('manage.table.driver')}</TableHead>
                    <TableHead>{t('manage.table.category')}</TableHead>
                    <TableHead>{t('manage.table.vehicle')}</TableHead>
                    {competition?.rules?.length > 0 && <TableHead>{t('manage.table.points')}</TableHead>}
                    {canUseOrganizerTools && <TableHead>{t('manage.table.actions')}</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedParticipants.map((participant, idx) => {
                    const info = getVehicleInfo(participant);
                    const draftValue = startOrderDraft[participant.id] ?? (
                      participant.start_order != null ? String(participant.start_order) : ''
                    );
                    return (
                      <TableRow key={participant.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell>
                          {canUseOrganizerTools ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                className="h-8 w-16"
                                value={draftValue}
                                disabled={startOrderSavingId === participant.id}
                                onChange={(e) => setStartOrderDraft((prev) => ({
                                  ...prev,
                                  [participant.id]: e.target.value,
                                }))}
                                onBlur={() => {
                                  const original = participant.start_order != null
                                    ? String(participant.start_order)
                                    : '';
                                  if (draftValue !== original) {
                                    saveStartOrder(participant.id, draftValue);
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={idx === 0 || startOrderSavingId != null}
                                onClick={() => moveParticipantOrder(participant.id, 'up')}
                              >
                                <ArrowUp className="size-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={idx === sortedParticipants.length - 1 || startOrderSavingId != null}
                                onClick={() => moveParticipantOrder(participant.id, 'down')}
                              >
                                <ArrowDown className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            participant.start_order ?? idx + 1
                          )}
                        </TableCell>
                        <TableCell>{participant.driver_name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Tags className="size-3" />
                            {getCategoryName(participant.category_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>{info ? `${info.manufacturer} ${info.model}` : '-'}</TableCell>
                        {competition?.rules?.length > 0 && (
                          <TableCell>{participant.points || 0}</TableCell>
                        )}
                        {canUseOrganizerTools && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => openEditModal(participant)}>
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleDeleteParticipant(participant.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {canUseOrganizerTools && (
          <TabsContent value="signups" className="mt-4">
            <CompetitionSignups competitionId={competitionId} onSignupApproved={loadCompetition} />
          </TabsContent>
        )}

        {showRoundConfigTab && (
          <TabsContent value="stages" className="mt-4">
            <CompetitionRoundStages
              competitionId={competitionId}
              competition={competition}
              readOnly={!canUseOrganizerTools}
            />
          </TabsContent>
        )}

        <TabsContent value="categories" className="mt-4">
          <CompetitionCategories
            competitionId={competitionId}
            onCategoryChange={loadCompetition}
            readOnly={!canUseOrganizerTools}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <CompetitionRulesPanel competitionId={competitionId} onRuleChange={() => {}} readOnly={!canUseOrganizerTools} />
        </TabsContent>
      </Tabs>

      {/* Modal: añadir desde favoritos */}
      <Dialog
        open={showFavoritesModal}
        onOpenChange={(open) => {
          setShowFavoritesModal(open);
          if (!open) setBulkError(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('manage.favoritesModal.title')}</DialogTitle>
            <DialogDescription>
              {t('manage.favoritesModal.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>{t('manage.favoritesModal.categoryForFavorites')}</Label>
              <Select value={favoritesCategoryId} onValueChange={setFavoritesCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('manage.memberSignup.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {(competition?.categories || []).map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('manage.favoritesModal.empty')}
              </p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {favorites.map((fav) => {
                  const already = usedFavoriteIds.has(fav.id);
                  const cfg = favoritesSelection[fav.id];
                  const hasDefaultVehicle = !!fav.default_vehicle_id || !!fav.default_vehicle_model;
                  return (
                    <div key={fav.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={!!cfg?.checked}
                          disabled={already}
                          onChange={() => toggleFavoriteCheck(fav.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{fav.display_name}</span>
                            {already && (
                              <Badge variant="outline" className="text-xs">{t('manage.favoritesModal.alreadyAdded')}</Badge>
                            )}
                            {fav.linked_slug && (
                              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                                <Link2 className="size-3" />
                                {fav.linked_slug}
                              </Badge>
                            )}
                          </div>
                          {hasDefaultVehicle && (
                            <div className="text-xs text-muted-foreground">
                              {fav.default_vehicle
                                ? `${fav.default_vehicle.manufacturer} ${fav.default_vehicle.model}`
                                : fav.default_vehicle_model}
                            </div>
                          )}
                        </div>
                      </div>

                      {cfg?.checked && !already && (
                        <div className="pl-6 space-y-2">
                          <div className="flex flex-wrap gap-3 text-xs">
                            {hasDefaultVehicle && (
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`bulk-fav-src-${fav.id}`}
                                  checked={cfg.vehicle_source === 'favorite_default'}
                                  onChange={() => updateFavoriteBulkRow(fav.id, { vehicle_source: 'favorite_default' })}
                                />
                                {t('manage.favoritesModal.vehicleDefault')}
                              </label>
                            )}
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`bulk-fav-src-${fav.id}`}
                                checked={cfg.vehicle_source === 'own'}
                                onChange={() => updateFavoriteBulkRow(fav.id, { vehicle_source: 'own' })}
                              />
                              {t('guestMembers.vehicleCollection')}
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`bulk-fav-src-${fav.id}`}
                                checked={cfg.vehicle_source === 'text'}
                                onChange={() => updateFavoriteBulkRow(fav.id, { vehicle_source: 'text' })}
                              />
                              {t('guestMembers.vehicleText')}
                            </label>
                          </div>
                          {cfg.vehicle_source === 'own' && (
                            <Select
                              value={cfg.vehicle_id}
                              onValueChange={(v) => updateFavoriteBulkRow(fav.id, { vehicle_id: v })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder={t('manage.favoritesModal.selectVehicle')} />
                              </SelectTrigger>
                              <SelectContent>
                                {vehicles.map((v) => (
                                  <SelectItem key={v.id} value={String(v.id)}>
                                    {v.manufacturer} {v.model} ({v.type})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {cfg.vehicle_source === 'text' && (
                            <Input
                              value={cfg.vehicle_model}
                              onChange={(e) => updateFavoriteBulkRow(fav.id, { vehicle_model: e.target.value })}
                              placeholder={t('guestMembers.vehicleTextPlaceholder')}
                              className="h-8 text-sm"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowFavoritesModal(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleBulkAddFromFavorites} disabled={bulkSaving}>
              {bulkSaving ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  {t('guestMembers.adding')}
                </>
              ) : (
                t('guestMembers.addSelected')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: añadir desde miembros del club sin cuenta */}
      <Dialog
        open={showGuestsModal}
        onOpenChange={(open) => {
          setShowGuestsModal(open);
          if (!open) setBulkError(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('guestMembers.addModalTitle')}</DialogTitle>
            <DialogDescription>{t('guestMembers.addModalDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {bulkError && (
              <Alert variant="destructive">
                <AlertDescription>{bulkError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label>{t('guestMembers.categoryLabel')}</Label>
              <Select value={guestsCategoryId} onValueChange={setGuestsCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('guestMembers.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {(competition?.categories || []).map((cat) => (
                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {eligibleGuestMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('guestMembers.empty')}{' '}
                {competition?.club_id && (
                  <Link to={`/clubs/${competition.club_id}`} className="underline">
                    {t('guestMembers.emptyManageLink')}
                  </Link>
                )}
              </p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {eligibleGuestMembers.map((guest) => {
                  const already = usedGuestMemberIds.has(guest.id);
                  const cfg = guestsSelection[guest.id];
                  return (
                    <div key={guest.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={!!cfg?.checked}
                          disabled={already}
                          onChange={() => toggleGuestCheck(guest.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{guest.name}</span>
                            {already && (
                              <Badge variant="outline" className="text-xs">{t('guestMembers.alreadyAdded')}</Badge>
                            )}
                          </div>
                          {guest.email && (
                            <div className="text-xs text-muted-foreground">{guest.email}</div>
                          )}
                        </div>
                      </div>

                      {cfg?.checked && !already && (
                        <div className="pl-6 space-y-2">
                          <div className="flex flex-wrap gap-3 text-xs">
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`bulk-guest-src-${guest.id}`}
                                checked={cfg.vehicle_source === 'own'}
                                onChange={() => updateGuestBulkRow(guest.id, { vehicle_source: 'own' })}
                              />
                              {t('guestMembers.vehicleCollection')}
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="radio"
                                name={`bulk-guest-src-${guest.id}`}
                                checked={cfg.vehicle_source === 'text'}
                                onChange={() => updateGuestBulkRow(guest.id, { vehicle_source: 'text' })}
                              />
                              {t('guestMembers.vehicleText')}
                            </label>
                          </div>
                          {cfg.vehicle_source === 'own' && (
                            <Select
                              value={cfg.vehicle_id}
                              onValueChange={(v) => updateGuestBulkRow(guest.id, { vehicle_id: v })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder={t('guestMembers.vehicleLabel')} />
                              </SelectTrigger>
                              <SelectContent>
                                {vehicles.map((v) => (
                                  <SelectItem key={v.id} value={String(v.id)}>
                                    {v.manufacturer} {v.model} ({v.type})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {cfg.vehicle_source === 'text' && (
                            <Input
                              value={cfg.vehicle_model}
                              onChange={(e) => updateGuestBulkRow(guest.id, { vehicle_model: e.target.value })}
                              placeholder={t('guestMembers.vehicleTextPlaceholder')}
                              className="h-8 text-sm"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowGuestsModal(false)}>
              {tCommon('actions.cancel')}
            </Button>
            <Button type="button" onClick={handleBulkAddFromGuests} disabled={bulkSaving}>
              {bulkSaving ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  {t('guestMembers.adding')}
                </>
              ) : (
                t('guestMembers.addSelected')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Añadir */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manage.addModal.title')}</DialogTitle>
            <DialogDescription>{t('manage.addModal.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddParticipant}>
            <div className="space-y-4 py-4">
              {addError && (
                <Alert variant="destructive">
                  <AlertDescription>{addError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label>{t('manage.addModal.participantType')}</Label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="participantType"
                      checked={participantType === 'own'}
                      onChange={() => {
                        setParticipantType('own');
                        setSelectedFavoriteId('');
                      }}
                      className="rounded-full"
                    />
                    {t('manage.addModal.fromCollection')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="participantType"
                      checked={participantType === 'external'}
                      onChange={() => {
                        setParticipantType('external');
                        setSelectedFavoriteId('');
                      }}
                      className="rounded-full"
                    />
                    {t('manage.addModal.external')}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="participantType"
                      checked={participantType === 'favorite'}
                      onChange={() => setParticipantType('favorite')}
                      className="rounded-full"
                      disabled={favorites.length === 0}
                    />
                    <span className="flex items-center gap-1">
                      <Star className="size-3" />
                      {t('manage.addModal.favorite')}
                    </span>
                  </label>
                  {competition?.club_id && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="participantType"
                        checked={participantType === 'club_guest'}
                        onChange={() => {
                          setParticipantType('club_guest');
                          setSelectedFavoriteId('');
                        }}
                        className="rounded-full"
                        disabled={eligibleGuestMembers.length === 0}
                      />
                      <span className="flex items-center gap-1">
                        <Users className="size-3" />
                        {t('guestMembers.participantType')}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="add-category">{t('manage.addModal.categoryRequired')}</Label>
                <Select
                  value={addForm.category_id}
                  onValueChange={(v) => setAddForm({ ...addForm, category_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('manage.addModal.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {competition.categories?.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {participantType === 'favorite' ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('manage.addModal.favoritePilotRequired')}</Label>
                    <Select
                      value={selectedFavoriteId}
                      onValueChange={(v) => {
                        setSelectedFavoriteId(v);
                        const fav = favorites.find((f) => f.id === v);
                        if (fav) {
                          setAddForm((prev) => ({
                            ...prev,
                            driver_name: fav.display_name,
                            vehicle_id: fav.default_vehicle_id || '',
                            vehicle_model: fav.default_vehicle_id ? '' : (fav.default_vehicle_model || ''),
                          }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('manage.addModal.selectFavorite')} />
                      </SelectTrigger>
                      <SelectContent>
                        {favorites.map((fav) => (
                          <SelectItem
                            key={fav.id}
                            value={fav.id}
                            disabled={usedFavoriteIds.has(fav.id)}
                          >
                            {fav.display_name}
                            {usedFavoriteIds.has(fav.id) ? t('manage.favoritesModal.alreadyAddedInSelect') : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t('manage.addModal.favoriteHint')}
                    </p>
                  </div>

                  {selectedFavoriteId && (
                    <div className="space-y-2">
                      <Label>{t('guestMembers.vehicleLabel')}</Label>
                      <Select
                        value={addForm.vehicle_id || 'none'}
                        onValueChange={(v) =>
                          setAddForm({
                            ...addForm,
                            vehicle_id: v === 'none' ? '' : v,
                            vehicle_model: v === 'none' ? addForm.vehicle_model : '',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('manage.addModal.useFavoriteVehicle')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('manage.addModal.useFavoriteDefaultOrText')}</SelectItem>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              {v.manufacturer} {v.model} ({v.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!addForm.vehicle_id && (
                        <Input
                          value={addForm.vehicle_model}
                          onChange={(e) => setAddForm({ ...addForm, vehicle_model: e.target.value })}
                          placeholder={t('manage.addModal.favoriteVehiclePlaceholder')}
                        />
                      )}
                    </div>
                  )}
                </>
              ) : participantType === 'club_guest' ? (
                <>
                  <div className="space-y-2">
                    <Label>{t('guestMembers.selectGuest')} *</Label>
                    <Select
                      value={selectedGuestId}
                      onValueChange={(v) => {
                        setSelectedGuestId(v);
                        const guest = eligibleGuestMembers.find((g) => g.id === v);
                        if (guest) {
                          setAddForm((prev) => ({
                            ...prev,
                            driver_name: guest.name,
                            vehicle_id: '',
                            vehicle_model: '',
                          }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('guestMembers.selectGuest')} />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleGuestMembers.map((guest) => (
                          <SelectItem
                            key={guest.id}
                            value={guest.id}
                            disabled={usedGuestMemberIds.has(guest.id)}
                          >
                            {guest.name}{usedGuestMemberIds.has(guest.id) ? ` (${t('guestMembers.alreadyAdded').toLowerCase()})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedGuestId && (
                    <div className="space-y-2">
                      <Label>{t('guestMembers.vehicleLabel')} *</Label>
                      <Select
                        value={addForm.vehicle_id || 'none'}
                        onValueChange={(v) =>
                          setAddForm({
                            ...addForm,
                            vehicle_id: v === 'none' ? '' : v,
                            vehicle_model: v === 'none' ? addForm.vehicle_model : '',
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('guestMembers.vehicleCollection')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('guestMembers.vehicleText')}</SelectItem>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              {v.manufacturer} {v.model} ({v.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!addForm.vehicle_id && (
                        <Input
                          value={addForm.vehicle_model}
                          onChange={(e) => setAddForm({ ...addForm, vehicle_model: e.target.value })}
                          placeholder={t('guestMembers.vehicleTextPlaceholder')}
                        />
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="add-driver">{t('manage.addModal.driverNameRequired')}</Label>
                    <Input
                      id="add-driver"
                      value={addForm.driver_name}
                      onChange={(e) => setAddForm({ ...addForm, driver_name: e.target.value })}
                      placeholder={t('manage.addModal.driverNamePlaceholder')}
                      required
                    />
                  </div>

                  {participantType === 'own' ? (
                    <div className="space-y-2">
                      <Label>{t('manage.addModal.vehicleRequired')}</Label>
                      <Select
                        value={addForm.vehicle_id}
                        onValueChange={(v) => setAddForm({ ...addForm, vehicle_id: v })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('manage.addModal.selectVehicle')} />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map((v) => (
                            <SelectItem key={v.id} value={String(v.id)}>
                              {v.manufacturer} {v.model} ({v.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="add-model">{t('manage.addModal.vehicleModelRequired')}</Label>
                      <Input
                        id="add-model"
                        value={addForm.vehicle_model}
                        onChange={(e) => setAddForm({ ...addForm, vehicle_model: e.target.value })}
                        placeholder={t('manage.addModal.vehicleModelPlaceholder')}
                        required
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={adding}>
                {adding ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    {t('manage.addModal.adding')}
                  </>
                ) : (
                  t('manage.addParticipant')
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={showEditModal} onOpenChange={(open) => !open && setShowEditModal(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('manage.editModal.title')}</DialogTitle>
            <DialogDescription>{t('manage.editModal.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditParticipant}>
            <div className="space-y-4 py-4">
              {editError && (
                <Alert variant="destructive">
                  <AlertDescription>{editError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-driver">{t('manage.addModal.driverNameRequired')}</Label>
                <Input
                  id="edit-driver"
                  value={editForm.driver_name}
                  onChange={(e) => setEditForm({ ...editForm, driver_name: e.target.value })}
                  placeholder={t('manage.addModal.driverNamePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t('manage.addModal.categoryRequired')}</Label>
                <Select
                  value={editForm.category_id}
                  onValueChange={(v) => setEditForm({ ...editForm, category_id: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('manage.addModal.selectCategory')} />
                  </SelectTrigger>
                  <SelectContent>
                    {competition.categories?.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('guestMembers.vehicleLabel')}</Label>
                <Select
                  value={editForm.vehicle_id}
                  onValueChange={(v) => setEditForm({ ...editForm, vehicle_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('manage.addModal.selectVehicle')} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.manufacturer} {v.model} ({v.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-model">{t('manage.editModal.customModel')}</Label>
                <Input
                  id="edit-model"
                  value={editForm.vehicle_model}
                  onChange={(e) => setEditForm({ ...editForm, vehicle_model: e.target.value })}
                  placeholder={t('manage.addModal.vehicleModelPlaceholder')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                {tCommon('actions.cancel')}
              </Button>
              <Button type="submit" disabled={editing}>
                {editing ? (
                  <>
                    <Spinner className="size-4 mr-2" />
                    {t('manage.editModal.saving')}
                  </>
                ) : (
                  <>
                    <Pencil className="size-4 mr-2" />
                    {t('manage.editModal.saveChanges')}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompetitionParticipants;
