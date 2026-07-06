export function calculateContainerStatus(gateInTime, gateOutTime) {
  if (!gateInTime) {
    return { hoursElapsed: 0, hoursRemaining: 72, demurrageFee: 0, isBreached: false };
  }

  // If gateOutTime exists, the clock stopped. Otherwise, use current time.
  const now = gateOutTime ? new Date(gateOutTime) : new Date();
  const start = new Date(gateInTime);
  
  // Calculate total hours spent in the ICD
  const millisecondsElapsed = now - start;
  const hoursElapsed = Math.floor(millisecondsElapsed / (1000 * 60 * 60));
  const hoursRemaining = 72 - hoursElapsed;
  
  let demurrageFee = 0;
  if (hoursElapsed > 72) {
    // $50 per hour past the 72-hour mark
    demurrageFee = (hoursElapsed - 72) * 50; 
  }

  return {
    hoursElapsed,
    hoursRemaining: hoursRemaining > 0 ? hoursRemaining : 0,
    demurrageFee,
    isBreached: hoursElapsed > 72
  };
}