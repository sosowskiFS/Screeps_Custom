// Defaults preserve existing behavior. Change Memory.settings in the console.
module.exports = {
    visualsEnabled: () => !Memory.settings || Memory.settings.visuals !== false,
    profilingEnabled: () => !!(Memory.settings && Memory.settings.profile),
};
