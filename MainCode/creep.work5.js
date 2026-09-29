// Compatibility dispatcher for mature-room logistics. Role state stays in creep.memory.
const mule = require('creep.mule');
const distributor = require('creep.distributor');
const mineralMiner = require('creep.mineralMiner');
const roles = Object.assign(Object.create(null), {
    mule: mule.run, muleNearDeath: mule.run,
    distributor: distributor.run, distributorNearDeath: distributor.run,
    mineralMiner: mineralMiner.run, mineralMinerNearDeath: mineralMiner.run,
});
module.exports = {
    run(creep) {
        const run = roles[creep.memory.priority];
        if (run) run(creep);
    }
};
