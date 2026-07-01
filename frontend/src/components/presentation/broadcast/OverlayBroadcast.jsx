import React, { useMemo } from 'react';
import BroadcastShell from './BroadcastShell';
import BroadcastLeaderboard from './BroadcastLeaderboard';
import BroadcastRoundPanel from './BroadcastRoundPanel';
import BroadcastSpotlight from './BroadcastSpotlight';
import BroadcastProgressMatrix from './BroadcastProgressMatrix';
import { findNextPilot } from '../../../utils/findNextPilot';

const OverlayBroadcast = ({
  scene,
  competition,
  status,
  globalBestLap,
  participants,
  displayedParticipants,
  rankingTitle,
  rankingSubtitle,
}) => {
  const nextPilotInfo = useMemo(
    () => findNextPilot(participants, competition?.rounds),
    [participants, competition?.rounds],
  );

  const currentRound = status?.current_round ?? nextPilotInfo?.roundNumber ?? 1;

  const renderScene = () => {
    switch (scene) {
      case 'ranking':
        return (
          <BroadcastLeaderboard
            participants={displayedParticipants}
            title={rankingTitle}
            subtitle={rankingSubtitle}
            autoScroll
            compact
          />
        );
      case 'bestlap':
        return (
          <BroadcastSpotlight
            globalBestLap={globalBestLap}
            nextPilotInfo={nextPilotInfo}
            showNextPilot={false}
          />
        );
      case 'nextpilot':
        return (
          <BroadcastSpotlight
            globalBestLap={globalBestLap}
            nextPilotInfo={nextPilotInfo}
            showBestLap={false}
          />
        );
      case 'round':
        return (
          <BroadcastRoundPanel participants={participants} roundNumber={currentRound} />
        );
      case 'progress':
        return (
          <BroadcastProgressMatrix
            competition={competition}
            participants={participants}
            compact
          />
        );
      default:
        return (
          <BroadcastLeaderboard
            participants={displayedParticipants}
            title={rankingTitle}
            subtitle={rankingSubtitle}
            autoScroll
            compact
          />
        );
    }
  };

  return (
    <BroadcastShell variant="overlay">
      <div className={`broadcast-overlay-scene broadcast-overlay-scene--${scene}`}>
        {renderScene()}
      </div>
    </BroadcastShell>
  );
};

export default OverlayBroadcast;
