var creep_harasser = {
    
    run: function(creep) {
        // Reset pathfinding memory when entering new room for better pathing
        if (creep.memory.previousRoom != creep.room.name) {
            creep.memory.previousRoom = creep.room.name;
            creep.memory._trav = undefined;
        }

        // Set NearDeath flag if creep is about to die
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'harasserNearDeath') {
            creep.memory.priority = 'harasserNearDeath';
        }
        
        // Move to target room if not there yet
        if (creep.room.name !== creep.memory.destination) {
            creep.travelTo(new RoomPosition(25, 25, creep.memory.destination), {
                stuckValue: 2,
                allowSK: true
            });
            
            // Set travel distance for death warning if not already set
            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }
            return;
        }
        
        // Find hostile creeps in the room (excluding whitelisted players)
        let hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: (target) => !Memory.whiteList.includes(target.owner.username)
        });
        
        if (hostiles.length > 0) {
            this.handleCombat(creep, hostiles);
        } else {
            // Check if creep is on room border and move into the room
            if (creep.pos.x === 0 || creep.pos.x === 49 || creep.pos.y === 0 || creep.pos.y === 49) {
                // Move towards center of room to get off the border
                let centerX = 25;
                let centerY = 25;
                creep.travelTo(new RoomPosition(centerX, centerY, creep.room.name), {
                    maxRooms: 1,
                    range: 20, // Just need to get off the border
                    ignoreCreeps: true
                });
            }
            // Otherwise do nothing if no hostiles - save CPU by not moving around
        }
    },
    
    handleCombat: function(creep, hostiles) {
        // Find the closest hostile
        let target = creep.pos.findClosestByRange(hostiles);
        if (!target) return;
        
        let range = creep.pos.getRangeTo(target);
        
        // Check if target has dangerous parts (ATTACK or RANGED_ATTACK)
        let hasDangerousParts = target.body.some(part => 
            part.type === ATTACK || part.type === RANGED_ATTACK
        );
        
        // Find nearby dangerous threats within range 3
        let dangerousThreats = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            filter: (eCreep) => !Memory.whiteList.includes(eCreep.owner.username) && 
                              eCreep.body.some(part => part.type === ATTACK || part.type === RANGED_ATTACK)
        });
        
        // Movement logic - avoid dangerous creeps, attack safe ones
        if (dangerousThreats.length > 0) {
            // Flee from dangerous threats - move away using Traveler flee mode
            let fleeTarget = creep.pos.findClosestByRange(dangerousThreats);
            if (fleeTarget) {
                creep.travelTo(fleeTarget, {
                    maxRooms: 1,
                    range: 4,
                    ignoreCreeps: false
                }, true); // true enables flee mode
            }
        } else if (hasDangerousParts && range <= 2) {
            // Target has dangerous parts but is close - back away using flee mode
            creep.travelTo(target, {
                maxRooms: 1,
                range: 3,
                ignoreCreeps: false
            }, true); // true enables flee mode
        } else if (!hasDangerousParts) {
            // Safe target without dangerous parts, move aggressively to range 1
            creep.travelTo(target, {
                maxRooms: 1,
                range: 1,
                ignoreCreeps: false
            });
        }
        
        // Attack logic - only attack if safe to do so
        if (range === 1 && !hasDangerousParts && dangerousThreats.length === 0) {
            creep.attack(target);
        }
    }
};

module.exports = creep_harasser;
