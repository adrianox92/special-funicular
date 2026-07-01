import React from 'react';
import BroadcastSpotlight from './broadcast/BroadcastSpotlight';

/** @deprecated Usar BroadcastSpotlight con showNextPilot={false} */
const BestLapHighlight = ({ bestLap, participant }) => {
  const globalBestLap =
    bestLap && participant
      ? {
          time_seconds: bestLap,
          driver_name: participant.driver_name,
          team_name: participant.team_name,
          vehicle_brand: participant.vehicle_brand,
          vehicle_name: participant.vehicle_name,
          round_number: null,
        }
      : null;

  return (
    <BroadcastSpotlight
      globalBestLap={globalBestLap}
      nextPilotInfo={null}
      showNextPilot={false}
    />
  );
};

export default BestLapHighlight;
