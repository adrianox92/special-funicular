import React from 'react';
import BroadcastSpotlight from './broadcast/BroadcastSpotlight';

/** @deprecated Usar BroadcastSpotlight con showBestLap={false} */
const NextPilotHighlight = ({ nextPilot, roundNumber }) => {
  const info = nextPilot
    ? { ...nextPilot, roundNumber: roundNumber ?? nextPilot.roundNumber }
    : null;

  return (
    <BroadcastSpotlight
      globalBestLap={null}
      nextPilotInfo={info}
      showBestLap={false}
    />
  );
};

export default NextPilotHighlight;
