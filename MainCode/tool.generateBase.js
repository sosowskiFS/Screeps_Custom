// tool.generateBase — entry point kept for the InitAutoBuild flag and older call sites.
// Layout planning and building now live in base.planner / base.builder.
const builder = require('base.builder');

module.exports = {
    // Plan (or replan) the room now and place its first construction sites.
    run: function (room) {
        return builder.replan(room);
    },
};
