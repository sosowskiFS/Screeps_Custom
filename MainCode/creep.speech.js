// Decorative/status speech only. Movement-coordination speech ("x;y" requests and
// the reply) must keep calling creep.say directly because other creeps read it.
const { creepSpeechEnabled } = require('runtime.config');
module.exports = {
    say(creep, message, isPublic) {
        if (creepSpeechEnabled()) creep.say(message, isPublic);
    }
};
