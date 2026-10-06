// Defaults preserve existing behavior unless noted. Change Memory.settings in the console.
module.exports = {
    visualsEnabled: () => !Memory.settings || Memory.settings.visuals !== false,
    profilingEnabled: () => !!(Memory.settings && Memory.settings.profile),
    // Off by default: every successful creep.say() is billed like an action (~0.2 CPU).
    creepSpeechEnabled: () => !!(Memory.settings && Memory.settings.creepSpeech),
    // Off by default: path lines and stuck/fatigue circles are drawn for every travelTo.
    travelerVisualsEnabled: () => !!(Memory.settings && Memory.settings.travelerVisuals),
};
