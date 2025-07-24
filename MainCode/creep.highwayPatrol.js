// filepath: e:\Git\Screeps\Screeps_Custom\MainCode\creep.highwayPatrol.js
var creep_highwayPatrol = {
    
    run: function(creep) {
        // Reset pathfinding memory when entering new room for better pathing
        if (creep.memory.previousRoom != creep.room.name) {
            creep.memory.previousRoom = creep.room.name;
            creep.memory._trav = undefined;
        }

        // Set NearDeath flag if creep is about to die
        if (creep.ticksToLive <= creep.memory.deathWarn && creep.memory.priority != 'highwayPatrolNearDeath') {
            creep.memory.priority = 'highwayPatrolNearDeath';
        }
        
        // Initialize patrol direction if not set
        if (!creep.memory.patrolDirection) {
            creep.memory.patrolDirection = 0;
        }
        
        // Determine current target room based on patrol direction
        let targetRoom = this.getPatrolTarget(creep);
        
        // Combat logic - prioritize combat over patrol
        let hostiles = creep.room.find(FIND_HOSTILE_CREEPS, {
            filter: (target) => !Memory.whiteList.includes(target.owner.username)
        });
        
        if (hostiles.length > 0) {
            this.handleCombat(creep, hostiles);
            return;
        }
        
        // Always heal self when not in combat
        this.healSelf(creep);
        
        // Continue patrol if no hostiles
        if (creep.room.name !== targetRoom) {
            // Travel to target room using travelTo
            creep.travelTo(new RoomPosition(25, 25, targetRoom), {
                stuckValue: 2,
                allowSK: true
            });
            
            // Set travel distance for death warning if not already set
            if (!creep.memory.travelDistance && creep.memory._trav && creep.memory._trav.path) {
                creep.memory.travelDistance = creep.memory._trav.path.length;
                creep.memory.deathWarn = (creep.memory.travelDistance + _.size(creep.body) * 3) + 15;
            }
        } else {
            // In target room, immediately move to next patrol room
            this.moveToNextPatrolRoom(creep);
        }
    },
    
    getPatrolTarget: function(creep) {
        let homeRoom = creep.memory.homeRoom;
        let direction = creep.memory.patrolDirection;
        
        // Get highway rooms around home room in order
        let patrolRooms = this.getHighwayRooms(homeRoom);
        
        if (patrolRooms.length === 0) {
            return homeRoom; // Fallback to home room
        }
        
        return patrolRooms[direction % patrolRooms.length];
    },
    
    getHighwayRooms: function(roomName) {
        // Parse room coordinates to extract numeric values
        let match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
        if (!match) return [];
        
        let [, xDir, xCoord, yDir, yCoord] = match;
        let xNum = parseInt(xCoord);
        let yNum = parseInt(yCoord);
        
        let highwayRooms = [];
        
        // Find nearest highway coordinates that contain '0'
        // For X coordinate: find the nearest multiple of 10
        let xHighways = [];
        let xLower = Math.floor(xNum / 10) * 10;
        let xUpper = xLower + 10;
        
        // Add highway X coordinates (multiples of 10)
        if (xLower >= 0) xHighways.push(xLower);
        if (xUpper >= 0) xHighways.push(xUpper);
        
        // For Y coordinate: find the nearest multiple of 10  
        let yHighways = [];
        let yLower = Math.floor(yNum / 10) * 10;
        let yUpper = yLower + 10;
        
        // Add highway Y coordinates (multiples of 10)
        if (yLower >= 0) yHighways.push(yLower);
        if (yUpper >= 0) yHighways.push(yUpper);
        
        // Create highway room names
        // Horizontal highways: keep original X direction/coordinate, use highway Y
        for (let yHwy of yHighways) {
            if (yHwy === 0) {
                // Special case for coordinate 0 - it appears as N0 or S0
                highwayRooms.push(xDir + xCoord + "N0");
                highwayRooms.push(xDir + xCoord + "S0");
            } else {
                highwayRooms.push(xDir + xCoord + yDir + yHwy);
            }
        }
        
        // Vertical highways: use highway X, keep original Y direction/coordinate
        for (let xHwy of xHighways) {
            if (xHwy === 0) {
                // Special case for coordinate 0 - it appears as E0 or W0
                highwayRooms.push("E0" + yDir + yCoord);
                highwayRooms.push("W0" + yDir + yCoord);
            } else {
                highwayRooms.push(xDir + xHwy + yDir + yCoord);
            }
        }
        
        // Intersection highways: both coordinates are multiples of 10
        for (let xHwy of xHighways) {
            for (let yHwy of yHighways) {
                if (xHwy === 0 && yHwy === 0) {
                    // Center intersection
                    highwayRooms.push("E0N0", "E0S0", "W0N0", "W0S0");
                } else if (xHwy === 0) {
                    highwayRooms.push("E0" + yDir + yHwy);
                    highwayRooms.push("W0" + yDir + yHwy);
                } else if (yHwy === 0) {
                    highwayRooms.push(xDir + xHwy + "N0");
                    highwayRooms.push(xDir + xHwy + "S0");
                } else {
                    highwayRooms.push(xDir + xHwy + yDir + yHwy);
                }
            }
        }
        
        // Remove duplicates and filter out invalid rooms
        let validHighways = [...new Set(highwayRooms)].filter(room => {
            // Verify it's actually a highway room (contains '0')
            return room.includes('0');
        });
        
        return validHighways.sort();
    },
    
    coordinatesToRoomName: function(x, y) {
        // Convert coordinates back to room name format
        let xName = x >= 0 ? "E" + x : "W" + (-x - 1);
        let yName = y >= 0 ? "S" + y : "N" + (-y - 1);
        return xName + yName;
    },
    
    handleCombat: function(creep, hostiles) {
        // Find the closest hostile
        let target = creep.pos.findClosestByRange(hostiles);
        if (!target) return;
        
        let range = creep.pos.getRangeTo(target);
        
        // Check if target has ATTACK parts to determine threat level
        let hasAttackParts = target.body.some(part => part.type === ATTACK);
        
        // Find nearby melee threats within range 3
        let meleeThreat = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
            filter: (eCreep) => !Memory.whiteList.includes(eCreep.owner.username) && 
                              eCreep.body.some(part => part.type === ATTACK)
        });
        
        // Movement logic with Traveler
        if (meleeThreat.length > 0 && hasAttackParts) {
            // Use Traveler's flee function to stay at range 3 from melee threats
            creep.travelTo(target, {
                maxRooms: 1,
                range: 3
            }, true); // true enables flee mode
        } else if (hasAttackParts) {
            // Enemy has attack parts but not in immediate threat range, maintain range 3
            if (range > 3) {
                creep.travelTo(target, {
                    ignoreRoads: true,
                    maxRooms: 1,
                    allowSK: true,
                    range: 3
                });
            } else if (range < 3) {
                // Too close, use flee to back away
                creep.travelTo(target, {
                    maxRooms: 1,
                    range: 3
                }, true);
            }
        } else {
            // Safe target without attack parts, move aggressively to range 1
            creep.travelTo(target, {
                ignoreRoads: true,
                maxRooms: 1,
                allowSK: true,
                range: 1
            });
        }
        
        // Attack logic based on range
        if (range <= 3) {
            if (range === 1) {
                // Use mass attack for maximum damage at range 1
                creep.rangedMassAttack();
                creep.attack(target);
            } else {
                // Use targeted ranged attack at range 2-3
                creep.rangedAttack(target);
                if (range === 2 && !hasAttackParts) {
                    // Safe to use melee attack at range 2 against non-melee targets
                    creep.attack(target);
                }
            }
        }
        
        // Heal self if damaged
        this.healSelf(creep);
    },
    
    moveAwayFrom: function(creep, target) {
        // This is now handled by travelTo with flee mode, keeping for compatibility
        creep.travelTo(target, {
            maxRooms: 1,
            range: 3
        }, true);
    },
    
    moveToRange: function(creep, target, desiredRange) {
        // This is now handled by travelTo with range parameter, keeping for compatibility
        creep.travelTo(target, {
            ignoreRoads: true,
            maxRooms: 1,
            allowSK: true,
            range: desiredRange
        });
    },
    
    healSelf: function(creep) {
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
        }
    },
    
    moveToNextPatrolRoom: function(creep) {
        // Mark current room as patrolled and move to next patrol target
        creep.memory.patrolDirection = (creep.memory.patrolDirection + 1) % 8;
        
        // Get next target room and move there
        let nextTargetRoom = this.getPatrolTarget(creep);
        creep.travelTo(new RoomPosition(25, 25, nextTargetRoom), {
            stuckValue: 2,
            allowSK: true
        });
    },
    
    setNewPatrolTarget: function(creep) {
        // Set a new random patrol target in the room
        let x = Math.floor(Math.random() * 40) + 5; // 5-44 to avoid edges
        let y = Math.floor(Math.random() * 40) + 5;
        
        creep.memory.patrolTarget = {x: x, y: y};
    }
};

module.exports = creep_highwayPatrol;