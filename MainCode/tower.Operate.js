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
        // A fresh pick every tick (the first tower of the tick; the others share it): a quad's members
        // trade places and heal each other, and a 5-tick-old pick was often the wrong one.
        if (Memory.towerTargetTick[thisRoom.name] != Game.time) {
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
        // A room still developing (below RCL8) repairs more often when its economy has room for it:
        // towers may spend REPAIR_BUDGET_SHARE of its spare energy a tick (system.energyFlow.budget;
        // a quarter without a storage, where building needs it), each repair 10 energy. Never slower
        // than the storage tiers above, never more than once a tick.
        if (thisRoom.controller && thisRoom.controller.level < 8) {
            checkDelay = Math.min(checkDelay, budgetRepairDelay(thisRoom, roomIntel));
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
            if (closestHostile && (closestHostile.pos.roomName != thisRoom.name || (isBorderPos(closestHostile.pos) && !killNow(closestHostile, thisRoom)))) {
                closestHostile = null;
                Memory.towerPickedTarget[thisRoom.name] = '';
            }
            if (!closestHostile) {
                //Find new target to shoot at.
                let allHostiles = [];
                let pHostiles = [];
                let allTowers = [];

                if (roomIntel && roomIntel.hostiles && roomIntel.pHostiles && roomIntel.allTowers) {
                    // On the border only when one volley kills it (killNow): it hops out otherwise.
                    allHostiles = roomIntel.hostiles.filter((eCreep) => !isBorderPos(eCreep.pos) || killNow(eCreep, thisRoom));
                    pHostiles = roomIntel.pHostiles.filter((eCreep) => !isBorderPos(eCreep.pos));
                    allTowers = roomIntel.allTowers;
                } else {
                    allHostiles = runtimeCache.find(tower.room, FIND_HOSTILE_CREEPS, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username) && (!isBorderPos(eCreep.pos) || killNow(eCreep, thisRoom)))
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

                // Fire when the towers and the defenders in range beat the target's healing (fastest
                // kill first), or to join defenders already shooting it even when they do not: the
                // attackers weigh potential damage and pull back from the wall under joint fire. With
                // neither, hold fire: energy is kept and the burst comes as a surprise. It used to
                // need a kill from towers and in-range defenders alone, and so never fired on W1N9's
                // healer quads (1,440+ healing a member), not even beside two defenders.
                // Joint fire short of a kill is a test (jointFireAllowed): if it moves nothing, it stops.
                let damageRecord = -Infinity;
                let targetToShoot = undefined;
                let targetNet = 0;
                let engagedDamage = 0;
                const consider = (hostile, net, engaged, defenderDamage) => {
                    if (engaged) engagedDamage = Math.max(engagedDamage, defenderDamage);
                    if (!(net > 0 || engaged) || isDrainBait(hostile, net)) return;
                    if (!(net > 0) && !jointFireAllowed(thisRoom.name, defenderDamage)) return;
                    const score = net > 0 ? 1e6 - hostile.hits / net : net;
                    if (score > damageRecord) {
                        damageRecord = score;
                        targetToShoot = hostile;
                        targetNet = net;
                    }
                };

                
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
                    consider(allHostiles[thisHostile], flatDamage - damageReduction, defenderDamage > 0, defenderDamage);
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
                        consider(pHostiles[thisHostile], flatDamage - damageReduction, defenderDamage > 0, defenderDamage);
                    }
                    
                }

                //if targetToShoot is defined, a valid target you can damage was found.
                if (targetToShoot) {
                    closestHostile = targetToShoot;
                }
                noteJointFire(thisRoom.name, allHostiles, !!targetToShoot && !(targetNet > 0), engagedDamage);
            }

            // Heal with no target to shoot, or for one of ours under HEAL_CRITICAL of its hits. It healed
            // whenever the target was near full hits: a quad tops its members up every tick, so the
            // towers healed a scratched defender in the middle of a joint burst.
            const healCritical = c => !closestHostile || c.hits < c.hitsMax * HEAL_CRITICAL;
            if (runtimeCache.current().roomCreeps[thisRoom.name]) {
                if (Game.flags[thisRoom.name + "RoomOperator"]) {
                    const powerCreep = tower.pos.findClosestByRange(FIND_MY_POWER_CREEPS);
                    if (powerCreep && powerCreep.hits < powerCreep.hitsMax && healCritical(powerCreep)) {
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
                    if (topInjured.hits < topInjured.hitsMax - 199 && healCritical(topInjured)) {
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
                    // Not while the shard's safe mode is reserved for another room (system.safeMode.mayActivate).
                    if (tower.room.controller.level < 7 && require('room.stage').established(tower.room) && require('system.safeMode').mayActivate(tower.room)) {
                        if (tower.pos.getRangeTo(closestHostile) <= 5 && closestHostile.owner.username != 'Invader') {
                            //Too close for comfort
                            tower.room.controller.activateSafeMode();
                        }
                    }
                    // Whatever is in reserve: a target is only picked when the shot counts (a kill, or
                    // with the defenders). A 2,000 storage + terminal floor kept W1N9's full towers
                    // silent after its stores ran low.
                    tower.attack(closestHostile);
                }
            }
        } else if (tower.energy >= 10 && oneShotTarget(thisRoom, roomIntel)) {
            // Not under attack (scouts, unarmed hoppers): every tower fires on one that a single volley
            // kills, border tiles included. E32N45's 1-MOVE border hopper was never shot.
            tower.attack(oneShotTarget(thisRoom, roomIntel));
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
                if (worthRepair(tower, intel.criticalRoad)) tower.repair(intel.criticalRoad);
            } else if (Memory.repairTarget[tower.room.name]) {
                let decayingRampart = Game.getObjectById(Memory.repairTarget[tower.room.name]);
                const guards = require('system.guardSquads');
                // Young rooms keep their rampart shell at its cap (system.guardSquads.rampartCap).
                const cap = guards.rampartCap(tower.room);
                const siegeRampart = cap !== Infinity && decayingRampart && decayingRampart.structureType === STRUCTURE_RAMPART;
                const siegeCap = siegeRampart ? cap : Infinity;
                if (decayingRampart && decayingRampart.hits != decayingRampart.hitsMax && decayingRampart.hits < siegeCap) {
                    if (!siegeRampart || guards.protectedRampart(tower.room, decayingRampart)) {
                        if (worthRepair(tower, decayingRampart)) tower.repair(decayingRampart);
                    }
                    else Memory.repairTarget[tower.room.name] = "";
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
const HEAL_CRITICAL = 0.4;

// A tower's repair at a range against its best (800 at TOWER_OPTIMAL_RANGE or less, a quarter from
// TOWER_FALLOFF_RANGE): the same 10 energy buys a quarter of the hits from far off.
function repairEfficiency(tower, target) {
    const range = tower.pos.getRangeTo(target);
    const near = typeof TOWER_OPTIMAL_RANGE !== 'undefined' ? TOWER_OPTIMAL_RANGE : 5;
    const far = typeof TOWER_FALLOFF_RANGE !== 'undefined' ? TOWER_FALLOFF_RANGE : 20;
    const falloff = typeof TOWER_FALLOFF !== 'undefined' ? TOWER_FALLOFF : 0.75;
    if (range <= near) return 1;
    if (range >= far) return 1 - falloff;
    return 1 - falloff * (range - near) / (far - near);
}
// Worth this tower's 10 energy. Roads always: towers are the only ones that repair them (the
// weakest planned road first, criticalRoad), so a far road skipped would decay, and hold every road
// behind it back. Ramparts and walls, which repairers also keep (100 hits an energy, a far tower
// 20): at REPAIR_MIN_EFFICIENCY or better, or under CRITICAL_BARRIER hits.
const REPAIR_MIN_EFFICIENCY = 0.5;
const CRITICAL_BARRIER = 10000;
function worthRepair(tower, target) {
    if (target.structureType === STRUCTURE_ROAD) return true;
    if (repairEfficiency(tower, target) >= REPAIR_MIN_EFFICIENCY) return true;
    return target.hits < CRITICAL_BARRIER;
}

// Ticks between tower repairs from the room's spare energy (system.energyFlow.budget): the towers
// that repair the room's target well (worthRepair's efficiency) spend REPAIR_BUDGET_SHARE of the
// budget (REPAIR_BUDGET_SHARE_YOUNG without a storage) scaled by how well they do it, each repair
// TOWER_ENERGY_COST: close towers repair often, far ones seldom. 250 (the old no-storage pace)
// with no budget to spare or no tower near enough.
const REPAIR_BUDGET_SHARE = 0.5;
const REPAIR_BUDGET_SHARE_YOUNG = 0.25;
const REPAIR_DELAY_MAX = 250;
function budgetRepairDelay(room, roomIntel) {
    const budget = require('system.energyFlow').budget(room);
    if (budget === null || !(budget > 0)) return REPAIR_DELAY_MAX;
    const towers = (roomIntel && roomIntel.allTowers && roomIntel.allTowers.length ? roomIntel.allTowers :
        runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })).filter(t => t.my !== false);
    const target = Memory.repairTarget && Memory.repairTarget[room.name] && Game.getObjectById(Memory.repairTarget[room.name]);
    const effs = target ? towers.map(t => repairEfficiency(t, target)).filter(e => e >= REPAIR_MIN_EFFICIENCY) : towers.map(() => 1);
    if (!effs.length) return REPAIR_DELAY_MAX;
    const efficiency = effs.reduce((a, b) => a + b, 0) / effs.length;
    const cost = typeof TOWER_ENERGY_COST !== 'undefined' ? TOWER_ENERGY_COST : 10;
    const share = room.storage ? REPAIR_BUDGET_SHARE : REPAIR_BUDGET_SHARE_YOUNG;
    return Math.max(1, Math.min(REPAIR_DELAY_MAX, Math.ceil(effs.length * cost / (budget * share * efficiency))));
}

// Joint fire short of a kill (towers joining defenders against more healing than they out-damage)
// only pays if it moves the attackers off the wall or wears them down. A quad that soaks it and stays
// put just drains the room's energy. So it is a test: after PROBE_TICKS of it, if no armed hostile
// has moved and none has lost PROBE_WEAR of its hits since it began, it stops for SUSPEND_TICKS.
// More defenders in range (their damage up by REENGAGE) lift the suspension; a kill always fires.
// Heap: room -> { start, at: { id: [x, y, hits] }, damage, until, suspendedAt }.
const PROBE_TICKS = 5;
const SUSPEND_TICKS = 25;
const PROBE_WEAR = 0.05;
const REENGAGE = 1.25;
const probes = Object.create(null);
function jointFireAllowed(roomName, defenderDamage) {
    const p = probes[roomName];
    if (!p || !p.until || Game.time >= p.until) return true;
    return defenderDamage >= (p.suspendedAt || 0) * REENGAGE;
}
function noteJointFire(roomName, hostiles, firing, defenderDamage) {
    let p = probes[roomName];
    if (p && p.until && Game.time >= p.until) p = probes[roomName] = null;
    if (!firing) {
        if (p && !p.until) probes[roomName] = null;
        return;
    }
    if (p && p.until) { probes[roomName] = null; p = null; }   // re-engaged: a new test
    if (!p) {
        const at = {};
        for (const h of hostiles) if (h.id) at[h.id] = [h.pos.x, h.pos.y, h.hits];
        probes[roomName] = { start: Game.time, at, damage: defenderDamage };
        return;
    }
    if (Game.time - p.start < PROBE_TICKS) return;
    const effect = hostiles.some(h => {
        const was = p.at[h.id];
        return !was || was[0] !== h.pos.x || was[1] !== h.pos.y || h.hits < was[2] - h.hitsMax * PROBE_WEAR;
    }) || Object.keys(p.at).some(id => !hostiles.some(h => h.id === id));
    if (effect) probes[roomName] = null;    // it works: keep at it, a fresh test
    else probes[roomName] = { until: Game.time + SUSPEND_TICKS, suspendedAt: Math.max(p.damage, defenderDamage) };
}

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

// Our towers' damage this tick against a hostile, net of the healing it can get (its own HEAL, its
// neighbours' within 3) and through boosted TOUGH: at least its hits, and one volley of every tower
// kills it. Cached per creep per tick.
let killCache = { t: -1, ids: Object.create(null) };
function killNow(hostile, room) {
    if (killCache.t !== Game.time) killCache = { t: Game.time, ids: Object.create(null) };
    if (killCache.ids[hostile.id] !== undefined) return killCache.ids[hostile.id];
    const staffing = require('defense.staffing');
    let damage = 0;
    for (const t of runtimeCache.find(room, FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })) {
        if ((t.store ? t.store[RESOURCE_ENERGY] || 0 : t.energy || 0) < 10 || (t.isActive && !t.isActive())) continue;
        damage += staffing.towerDamage(t.pos.getRangeTo(hostile));
    }
    damage *= staffing.toughFactor(hostile);
    const healOf = (creep, adjacent) => (creep.body || []).reduce((n, p) => {
        if (p.type !== HEAL || p.hits <= 0) return n;
        const table = typeof BOOSTS !== 'undefined' && BOOSTS.heal;
        const boost = p.boost && table && table[p.boost] ? table[p.boost][adjacent ? 'heal' : 'rangedHeal'] : 1;
        return n + (adjacent ? HEAL_POWER : RANGED_HEAL_POWER) * boost;
    }, 0);
    let heal = healOf(hostile, true);
    for (const other of runtimeCache.find(room, FIND_HOSTILE_CREEPS)) {
        if (other.id === hostile.id) continue;
        const r = other.pos.getRangeTo(hostile);
        if (r <= 3) heal += healOf(other, r <= 1);
    }
    return (killCache.ids[hostile.id] = damage - heal >= hostile.hits);
}

// A hostile one volley kills, not whitelisted, in a room not under attack; or null. Per room per tick.
let oneShotCache = { t: -1, rooms: Object.create(null) };
function oneShotTarget(room, roomIntel) {
    if (oneShotCache.t !== Game.time) oneShotCache = { t: Game.time, rooms: Object.create(null) };
    if (oneShotCache.rooms[room.name] !== undefined) return oneShotCache.rooms[room.name];
    const hostiles = (roomIntel && roomIntel.hostiles) || runtimeCache.find(room, FIND_HOSTILE_CREEPS, {
        filter: c => !Memory.whiteList.includes(c.owner.username)
    });
    const target = hostiles.find(c => killNow(c, room)) || null;
    return (oneShotCache.rooms[room.name] = target);
}

function isBorderPos(pos) {
    return pos && (pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49);
}

tower_Operate.isDrainBait = isDrainBait; // exposed for tests
tower_Operate.killNow = killNow;
tower_Operate.budgetRepairDelay = budgetRepairDelay;
tower_Operate.worthRepair = worthRepair;
tower_Operate.repairEfficiency = repairEfficiency;
tower_Operate.oneShotTarget = oneShotTarget;
tower_Operate.PROBE_TICKS = PROBE_TICKS;
module.exports = tower_Operate;
