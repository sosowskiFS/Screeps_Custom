const { leastHits } = require('util.common');
const runtimeCache = require('runtime.cache');
const defenseWatch = require('defense.watch');
const maintenance = require('system.maintenance');
const roads = require('system.roads');
var tower_Operate = {
    run: function(tower, attackDuration, towerNum, roomIntel) {
        //My bit that computes "how much damage could my towers do to creep x?" counted inactive towers
        //Count defender damage from current ones as well
        //Remember to factor in boosted ranged parts
        //Check after picking target, and check with range of 1 for nearby healers, totalling healing parts
        var thisRoom = tower.room;

        if (!Memory.towerNeedEnergy[thisRoom.name]) {
            Memory.towerNeedEnergy[thisRoom.name] = [];
        }
        if (!Memory.towerPickedTarget[thisRoom.name]) {
            Memory.towerPickedTarget[thisRoom.name] = '';
        }
        if (!Memory.towerTargetTick) {
            Memory.towerTargetTick = {};
        }
        if (Game.time % 5 == 0 && Memory.towerTargetTick[thisRoom.name] != Game.time) {
            /*if (Memory.towerPickedTarget[thisRoom.name]) {
                let thisHostile = Game.getObjectById(Memory.towerPickedTarget[thisRoom.name]);
                if (thisHostile && thisHostile.hits > (thisHostile.hitsMax - 500)) {
                    Memory.towerPickedTarget[thisRoom.name] = '';
                }
            } else {
                Memory.towerPickedTarget[thisRoom.name] = '';
            }*/

            Memory.towerPickedTarget[thisRoom.name] = '';
            Memory.towerTargetTick[thisRoom.name] = Game.time;
        }

        const showTowerDamageText = !!Game.flags[thisRoom.name + "TowerDebug"];

        var checkDelay;
        if (thisRoom.storage) {
            if (thisRoom.storage.store[RESOURCE_ENERGY] >= 425000) {
                checkDelay = 10;
            } else if (thisRoom.storage.store[RESOURCE_ENERGY] >= 225000) {
                checkDelay = 20;
            } else if (thisRoom.storage.store[RESOURCE_ENERGY] < 100000) {
                checkDelay = 50;
            } else if (thisRoom.storage.store[RESOURCE_ENERGY] < 225000) {
                checkDelay = 35;
            }
        } else {
            checkDelay = 250;
        }
        if (maintenance.inMaintenance(thisRoom.name)) {
            checkDelay = 100; // ramparts are already above the nuke threshold; roads decay slowly
        }

        let UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        if (UnderAttackPos >= 0 && tower.energy > 0) {
            //runtimeCache.current().roomCreeps[thisRoom.name];
            //Only if no salvager flag
            let didHeal = false
            let salvagerPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
            let hostileCount = 1;

            let defenders = _.filter(runtimeCache.current().roomCreeps[thisRoom.name], (creep) => creep.memory.priority == 'defender');

            let closestHostile = Game.getObjectById(Memory.towerPickedTarget[thisRoom.name]);
            if (closestHostile && (closestHostile.pos.roomName != thisRoom.name || isBorderPos(closestHostile.pos))) {
                closestHostile = null;
                Memory.towerPickedTarget[thisRoom.name] = '';
            }
            if (!closestHostile) {
                //Find new target to shoot at.
                let allHostiles = [];
                let pHostiles = [];
                let allTowers = [];

                if (roomIntel && roomIntel.hostiles && roomIntel.pHostiles && roomIntel.allTowers) {
                    allHostiles = roomIntel.hostiles.filter((eCreep) => !isBorderPos(eCreep.pos));
                    pHostiles = roomIntel.pHostiles.filter((eCreep) => !isBorderPos(eCreep.pos));
                    allTowers = roomIntel.allTowers;
                } else {
                    allHostiles = runtimeCache.find(tower.room, FIND_HOSTILE_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && !isBorderPos(eCreep.pos))
                    });
                    pHostiles = runtimeCache.find(tower.room, FIND_HOSTILE_POWER_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && !isBorderPos(eCreep.pos))
                    });
                    allTowers = runtimeCache.find(tower.room, FIND_STRUCTURES, {
                        filter: { structureType: STRUCTURE_TOWER }
                    });
                }
                hostileCount = 0
                if (allHostiles.length) {
                    hostileCount += allHostiles.length;
                }
                if (pHostiles.length) {
                    hostileCount += pHostiles.length;
                }

                let damageRecord = 0;
                let targetToShoot = undefined;

                
                //Calculate potential defender damage
                for (let thisHostile in allHostiles) {
                    //Shoot at whatever target you can do the most damage to
                    //Calculate flat tower damage
                    let flatDamage = 0;
                    for (let thisTower in allTowers) {
                        if (!allTowers[thisTower].isActive() || allTowers[thisTower].energy <= 0) {
                            continue;
                        }
                        let thisRange = allTowers[thisTower].pos.getRangeTo(allHostiles[thisHostile]);
                        let thisTowerDamage = TOWER_POWER_ATTACK;
                        if (thisRange > TOWER_OPTIMAL_RANGE) {
                            if (thisRange > TOWER_FALLOFF_RANGE) {
                                thisRange = TOWER_FALLOFF_RANGE;
                            }
                            thisTowerDamage -= thisTowerDamage * TOWER_FALLOFF * (thisRange - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
                        }
                        if (allTowers[thisTower].effects) {
                            for (let thisPower in allTowers[thisTower].effects) {
                                let powerEffect = allTowers[thisTower].effects[thisPower];
                                if (powerEffect.effect == PWR_OPERATE_TOWER || powerEffect.effect == PWR_DISRUPT_TOWER) {
                                    thisTowerDamage *= POWER_INFO[powerEffect.effect].effect[powerEffect.level - 1];
                                }
                            }
                        }
                        flatDamage += Math.floor(thisTowerDamage);
                    }

                    //Add in potential defender damage
                    let defenderDamage = 0;             
                    for (let thisDefender in defenders) {
                        if (defenders[thisDefender].pos.inRangeTo(allHostiles[thisHostile], 3)) {
                            defenders[thisDefender].body.forEach(function(thisPart) {
                                if (thisPart.hits > 0) {
                                    if (thisPart.type == RANGED_ATTACK && thisPart.boost) {
                                        defenderDamage += RANGED_ATTACK_POWER * BOOSTS['ranged_attack'][thisPart.boost]['rangedAttack']
                                    } else if (thisPart.type == RANGED_ATTACK) {
                                        defenderDamage += RANGED_ATTACK_POWER
                                    }
                                }
                            });
                        }                      
                    }
                    flatDamage += defenderDamage;

                    //Subtract target's TOUGH & HEAL damage soak
                    let damageReduction = 0;
                    let boostedTough = undefined;

                    if (!thisRoom.controller.safeMode) {
                        allHostiles[thisHostile].body.forEach(function(thisPart) {
                            if (thisPart.hits > 0) {
                                if (thisPart.type == TOUGH && thisPart.boost) {
                                    boostedTough = thisPart.boost;
                                } else if (thisPart.type == HEAL && thisPart.boost) {
                                    damageReduction += HEAL_POWER * BOOSTS['heal'][thisPart.boost]['heal']
                                } else if (thisPart.type == HEAL) {
                                    damageReduction += HEAL_POWER
                                }
                            }
                        });
                        //Look for healer creeps within 3 spaces of target creep for further subtractions
                        let nearbyFriendos = allHostiles[thisHostile].pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                            filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && eCreep.id != allHostiles[thisHostile].id)
                        });
                        for (let thisFriendo in nearbyFriendos) {
                            let friendRange = allHostiles[thisHostile].pos.getRangeTo(nearbyFriendos[thisFriendo]);
                            nearbyFriendos[thisFriendo].body.forEach(function(thisPart) {
                                if (thisPart.hits > 0) {
                                    if (thisPart.type == HEAL && thisPart.boost) {
                                        if (friendRange == 1) {
                                            damageReduction += HEAL_POWER * BOOSTS['heal'][thisPart.boost]['heal']
                                        } else {
                                            damageReduction += RANGED_HEAL_POWER * BOOSTS['heal'][thisPart.boost]['rangedHeal']
                                        }
                                    } else if (thisPart.type == HEAL) {
                                        if (friendRange == 1) {
                                            damageReduction += HEAL_POWER
                                        } else {
                                            damageReduction += RANGED_HEAL_POWER
                                        }
                                    }
                                }
                            });
                        }

                        //Factor in damage reduction from Tough parts
                        if (boostedTough) {
                            flatDamage = flatDamage * BOOSTS['tough'][boostedTough]['damage']
                        }
                    }
                    

                    //Display the calculated damage total under the target
                    let dColor = 'green';
                    if ((flatDamage - damageReduction) <= 0) {
                        dColor = 'red';
                    }
                    if (showTowerDamageText) {
                        new RoomVisual(thisRoom.name).text((flatDamage - damageReduction).toString(), allHostiles[thisHostile].pos.x, allHostiles[thisHostile].pos.y, { color: dColor, font: 0.3 });
                    }

                    //Determine if this beats the best
                    if ((flatDamage - damageReduction) > damageRecord && !isDrainBait(allHostiles[thisHostile], flatDamage - damageReduction)) {
                        damageRecord = (flatDamage - damageReduction);
                        targetToShoot = allHostiles[thisHostile];
                    }
                }

                for (let thisHostile in pHostiles) {
                    //Shoot at whatever target you can do the most damage to
                    //Calculate flat tower damage
                    let flatDamage = 0;
                    for (let thisTower in allTowers) {
                        if (!allTowers[thisTower].isActive() || allTowers[thisTower].energy <= 0) {
                            continue;
                        }
                        let thisRange = allTowers[thisTower].pos.getRangeTo(pHostiles[thisHostile]);
                        let thisTowerDamage = TOWER_POWER_ATTACK;
                        if (thisRange > TOWER_OPTIMAL_RANGE) {
                            if (thisRange > TOWER_FALLOFF_RANGE) {
                                thisRange = TOWER_FALLOFF_RANGE;
                            }
                            thisTowerDamage -= thisTowerDamage * TOWER_FALLOFF * (thisRange - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE);
                        }
                        if (allTowers[thisTower].effects) {
                            for (let thisPower in allTowers[thisTower].effects) {
                                let powerEffect = allTowers[thisTower].effects[thisPower];
                                if (powerEffect.effect == PWR_OPERATE_TOWER || powerEffect.effect == PWR_DISRUPT_TOWER) {
                                    thisTowerDamage *= POWER_INFO[powerEffect.effect].effect[powerEffect.level - 1];
                                }
                            }
                        }
                        flatDamage += Math.floor(thisTowerDamage);
                    }

                    //Add in potential defender damage
                    let defenderDamage = 0;             
                    for (let thisDefender in defenders) {
                        if (defenders[thisDefender].pos.inRangeTo(pHostiles[thisHostile], 3)) {
                            defenders[thisDefender].body.forEach(function(thisPart) {
                                if (thisPart.hits > 0) {
                                    if (thisPart.type == RANGED_ATTACK && thisPart.boost) {
                                        defenderDamage += RANGED_ATTACK_POWER * BOOSTS['ranged_attack'][thisPart.boost]['rangedAttack']
                                    } else if (thisPart.type == RANGED_ATTACK) {
                                        defenderDamage += RANGED_ATTACK_POWER
                                    }
                                }
                            });
                        }                      
                    }
                    flatDamage += defenderDamage;

                    //Subtract target's TOUGH & HEAL damage soak
                    let damageReduction = 0;
                    let boostedTough = undefined;

                    if (!thisRoom.controller.safeMode && pHostiles[thisHostile] && pHostiles[thisHostile].body) {
                        pHostiles[thisHostile].body.forEach(function(thisPart) {
                            if (thisPart.hits > 0) {
                                if (thisPart.type == TOUGH && thisPart.boost) {
                                    boostedTough = thisPart.boost;
                                } else if (thisPart.type == HEAL && thisPart.boost) {
                                    damageReduction += HEAL_POWER * BOOSTS['heal'][thisPart.boost]['heal']
                                } else if (thisPart.type == HEAL) {
                                    damageReduction += HEAL_POWER
                                }
                            }
                        });
                    }

                    //Look for healer creeps within 3 spaces of target creep for further subtractions
                    let nearbyFriendos = pHostiles[thisHostile].pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                    });
                    for (let thisFriendo in nearbyFriendos) {
                        let friendRange = pHostiles[thisHostile].pos.getRangeTo(nearbyFriendos[thisFriendo]);
                        nearbyFriendos[thisFriendo].body.forEach(function(thisPart) {
                            if (thisPart.hits > 0) {
                                if (thisPart.type == HEAL && thisPart.boost) {
                                    if (friendRange == 1) {
                                        damageReduction += HEAL_POWER * BOOSTS['heal'][thisPart.boost]['heal']
                                    } else {
                                        damageReduction += RANGED_HEAL_POWER * BOOSTS['heal'][thisPart.boost]['rangedHeal']
                                    }
                                } else if (thisPart.type == HEAL) {
                                    if (friendRange == 1) {
                                        damageReduction += HEAL_POWER
                                    } else {
                                        damageReduction += RANGED_HEAL_POWER
                                    }
                                }
                            }
                        });
                    }

                    //Factor in damage reduction from Tough parts
                    if (boostedTough) {
                        flatDamage = flatDamage * BOOSTS['tough'][boostedTough]['damage']
                    }

                    //Display the calculated damage total under the target
                    let dColor = 'green';
                    if (flatDamage <= 0) {
                        dColor = 'red';
                    }
                    if (pHostiles[thisHostile]) {
                        if (showTowerDamageText) {
                            new RoomVisual(thisRoom.name).text((flatDamage - damageReduction).toString(), pHostiles[thisHostile].pos.x, pHostiles[thisHostile].pos.y, { color: dColor, font: 0.3 });
                        }

                        //Determine if this beats the best
                        if ((flatDamage - damageReduction) > damageRecord && !isDrainBait(pHostiles[thisHostile], flatDamage - damageReduction)) {
                            damageRecord = (flatDamage - damageReduction);
                            targetToShoot = pHostiles[thisHostile];
                        }
                    }
                    
                }

                //if targetToShoot is defined, a valid target you can damage was found.
                if (targetToShoot) {
                    closestHostile = targetToShoot;
                }
            }

            //Heal only if the target isn't taking damage
            if (runtimeCache.current().roomCreeps[thisRoom.name] && (!closestHostile || closestHostile.hits > (closestHostile.hitsMax - 500))) {
                if (Game.flags[thisRoom.name + "RoomOperator"]) {
                    const powerCreep = tower.pos.findClosestByRange(FIND_MY_POWER_CREEPS);
                    if (powerCreep && powerCreep.hits < powerCreep.hitsMax) {
                        tower.heal(powerCreep);
                        didHeal = true;
                    }
                }
                let topInjured = roomIntel && roomIntel.mostInjuredCreep ? roomIntel.mostInjuredCreep : undefined;
                if (!topInjured || (topInjured.hits >= topInjured.hitsMax)) {
                    let allCreeps = runtimeCache.current().roomCreeps[thisRoom.name];
                    if (allCreeps && allCreeps.length) {
                        for (let i = 0; i < allCreeps.length; i++) {
                            if (!topInjured || (allCreeps[i].hitsMax - allCreeps[i].hits) > (topInjured.hitsMax - topInjured.hits)) {
                                topInjured = allCreeps[i];
                            }
                        }
                    }
                }
                if (topInjured && !didHeal) {
                    if (topInjured.hits < topInjured.hitsMax - 199) {
                        tower.heal(topInjured);
                        didHeal = true;
                    }
                }
            }

            if (!didHeal) {
                if (salvagerPos >= 0) {
                    //Verify that it's still not worth the time
                    //RETUNE - this could possibly spawn defenders if a big enough invader wave attacks
                    // No target only escalates when a hostile is inside the room (towers cannot hurt it) or
                    // sieging. Untargetable creeps sitting on the exit are drain bait.
                    if ((!closestHostile && defenseWatch.hasInnerHostile(thisRoom.name)) || (closestHostile && determineCreepThreat(closestHostile, hostileCount))) {
                        //BAD TIMES
                        Memory.roomsPrepSalvager.splice(salvagerPos, 1);
                        salvagerPos = -1;
                    }
                }

                if (closestHostile) {
                    if (closestHostile.owner.username != "Invader" && closestHostile.hitsMax > 200) {
                        Game.notify('ROOM DEFENCE : ' + closestHostile.owner.username + ' is tresspassing in ' + thisRoom.name);
                        Memory.LastNotification = Game.time.toString() + ' : ' + closestHostile.owner.username + ' is tresspassing in ' + thisRoom.name
                    }
                    Memory.towerPickedTarget[thisRoom.name] = closestHostile.id;

                    // Rooms still under construction (no terminal) use system.safeMode instead: safe
                    // mode only once something of ours is actually being damaged.
                    if (tower.room.controller.level < 7 && require('room.stage').established(tower.room)) {
                        if (tower.pos.getRangeTo(closestHostile) <= 5 && closestHostile.owner.username != 'Invader') {
                            //Too close for comfort
                            tower.room.controller.activateSafeMode();
                        }
                    }
                    if ((!thisRoom.storage || thisRoom.storage.store[RESOURCE_ENERGY] >= 2000) || closestHostile.owner.username == 'Invader') {
                        tower.attack(closestHostile);
                    }
                }
            }
        } else if ((tower.energy > (tower.energyCapacity * 0.5)) && (Game.time % checkDelay == 0)) {
            // All towers see the same tick snapshot; choose this target once.
            const intel = roomIntel || {};
            if (!Object.prototype.hasOwnProperty.call(intel, 'criticalRoad')) {
                intel.criticalRoad = leastHits(runtimeCache.find(tower.room, FIND_STRUCTURES, {
                    // Planned roads only: unused roads are left to decay.
                    filter: structure => structure.structureType == STRUCTURE_ROAD && structure.hits < structure.hitsMax / 2 &&
                        roads.isPriority(structure.pos.roomName, structure.pos.x, structure.pos.y)
                })) || null;
            }
            if (intel.criticalRoad) {
                tower.repair(intel.criticalRoad);
            } else if (Memory.repairTarget[tower.room.name]) {
                let decayingRampart = Game.getObjectById(Memory.repairTarget[tower.room.name]);
                if (decayingRampart && decayingRampart.hits != decayingRampart.hitsMax) {
                    tower.repair(decayingRampart);
                } else {
                    //Bad target, let main handle reassignment
                    Memory.repairTarget[tower.room.name] = undefined;
                }
            }
        } else {
            //Check for damaged creeps & repair
            let didHeal = false;
            if (Game.flags[thisRoom.name + "RoomOperator"]) {
                const powerCreep = tower.pos.findClosestByRange(FIND_MY_POWER_CREEPS);
                if (powerCreep && powerCreep.hits < powerCreep.hitsMax) {
                    tower.heal(powerCreep);
                    didHeal = true;
                }
            }
            let topInjured = roomIntel && roomIntel.mostInjuredCreep ? roomIntel.mostInjuredCreep : undefined;
            if (!topInjured || (topInjured.hits >= topInjured.hitsMax)) {
                let allCreeps = runtimeCache.current().roomCreeps[thisRoom.name];
                if (allCreeps && allCreeps.length) {
                    for (let i = 0; i < allCreeps.length; i++) {
                        if (!topInjured || (allCreeps[i].hitsMax - allCreeps[i].hits) > (topInjured.hitsMax - topInjured.hits)) {
                            topInjured = allCreeps[i];
                        }
                    }
                }
            }
            if (topInjured && !didHeal) {
                if (topInjured.hits < topInjured.hitsMax) {
                    tower.heal(topInjured);
                    didHeal = true;
                }
            }
        }

        if (tower.energy <= tower.energyCapacity - 150 && Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id) == -1) {
            Memory.towerNeedEnergy[thisRoom.name].push(tower.id);
        } else if (tower.energy > tower.energyCapacity - 150 && Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id) > -1) {
            var thisTowerIndex = Memory.towerNeedEnergy[thisRoom.name].indexOf(tower.id)
            Memory.towerNeedEnergy[thisRoom.name].splice(thisTowerIndex, 1);
        }
        //Enable to see tower coverage
        //thisRoom.visual.rect(thisTower.pos.x - 15, thisTower.pos.y - 15, 30, 30, {fill: '#ff0019', opacity: 0.2});
        //wew
    }
};

function repairCompare(a, b) {
    if (a.hits < b.hits)
        return -1;
    if (a.hits > b.hits)
        return 1;
    return 0;
}

function healCompare(a, b) {
    let aDiff = a.hitsMax - a.hits;
    let bDiff = b.hitsMax - b.hits;
    if (aDiff < bDiff)
        return 1;
    if (aDiff > bDiff)
        return -1;
    return 0;
}

// True for boosted player creeps. (The old version returned from inside forEach: always false.)
function determineCreepThreat(eCreep, totalHostiles) {
    if (!eCreep.body) return false; // power creeps
    if ((eCreep.owner.username == 'Invader' || eCreep.name.indexOf('Drainer') >= 0) || (eCreep.hitsMax <= 1000 && totalHostiles <= 1)) {
        return false;
    }
    return eCreep.body.some(thisPart => thisPart.boost);
}

// Tower-drain bait: within 2 tiles of an exit (it steps out to heal before dying) and not
// killable within 2 ticks. Shooting it only spends energy. Creeps damaging structures are
// always worth shooting.
function isDrainBait(hostile, netDamage) {
    if (defenseWatch.edgeDistance(hostile.pos) > 2) return false;
    if (netDamage * 2 >= hostile.hits) return false;
    return !defenseWatch.isSieging(hostile);
}

function isBorderPos(pos) {
    return pos && (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49);
}

tower_Operate.isDrainBait = isDrainBait; // exposed for tests
module.exports = tower_Operate;
