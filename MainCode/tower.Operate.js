var tower_Operate = {
    run: function(tower, attackDuration, towerNum) {
        //My bit that computes "how much damage could my towers do to creep x?" counted inactive towers
        //Count defender damage from current ones as well
        //Remember to factor in boosted ranged parts
        //Check after picking target, and check with range of 1 for nearby healers, totalling healing parts
        var thisRoom = tower.room;

        if (!Memory.towerNeedEnergy[thisRoom.name]) {
            Memory.towerNeedEnergy[thisRoom.name] = [];
        }
        if (!Memory.towerPickedTarget[thisRoom.name] || Game.time % 5 == 0) {
            if (Memory.towerPickedTarget[thisRoom.name]) {
                let thisHostile = Game.getObjectById(Memory.towerPickedTarget[thisRoom.name]);
                if (thisHostile && thisHostile.hits > (thisHostile.hitsMax - 500)) {
                    Memory.towerPickedTarget[thisRoom.name] = '';
                }
            } else {
                Memory.towerPickedTarget[thisRoom.name] = '';
            }

        }

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

        let UnderAttackPos = Memory.roomsUnderAttack.indexOf(thisRoom.name);
        if (UnderAttackPos >= 0 && tower.energy > 0) {
            //Memory.roomCreeps[thisRoom.name];
            //Only if no salvager flag
            let didHeal = false
            let salvagerPos = Memory.roomsPrepSalvager.indexOf(thisRoom.name);
            let hostileCount = 1;

            let defenders = _.filter(Memory.roomCreeps[thisRoom.name], (creep) => creep.memory.priority == 'defender');

            let closestHostile = Game.getObjectById(Memory.towerPickedTarget[thisRoom.name]);
            if (!closestHostile) {
                //Find new target to shoot at.
                let allHostiles = tower.room.find(FIND_HOSTILE_CREEPS, {
                    filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                });
                let allTowers = tower.room.find(FIND_STRUCTURES, {
                    filter: (structure) => (structure.structureType = STRUCTURE_TOWER)
                });
                hostileCount = allHostiles.length;

                let damageRecord = 0;
                let targetToShoot = undefined;

                for (let thisHostile in allHostiles) {
                    //Shoot at whatever target you can do the most damage to
                    //Calculate flat tower damage
                    let flatDamage = 0;
                    for (let thisTower in allTowers) {
                        let thisRange = thisTower.pos.getRangeTo(thisHostile);
                        if (thisRange <= 5) {
                            flatDamage += TOWER_POWER_ATTACK;
                        } else if (thisRange >= 20) {
                            flatDamage += TOWER_POWER_ATTACK - (TOWER_FALLOFF * TOWER_POWER_ATTACK);
                        } else {
                            //Midrange calculation
                            flatDamage += TOWER_POWER_ATTACK - (((thisRange - 5) * (TOWER_FALLOFF / 15)) * TOWER_POWER_ATTACK)
                        }
                    }

                    //Add in potential defender damage
                    for (let thisDefender in defenders) {
                        thisDefender.body.forEach(function(thisPart) {
                            if (thisPart.type == RANGED_ATTACK && thisPart.boost) {
                                flatDamage += RANGED_ATTACK_POWER * BOOSTS['ranged_attack'][thisPart.boost]['rangedAttack']
                            } else if (thisPart.type == RANGED_ATTACK) {
                                flatDamage += RANGED_ATTACK_POWER
                            }
                        });
                    }

                    //Subtract target's TOUGH & HEAL damage soak
                    let damageReduction = 0;
                    let boostedTough = undefined;

                    thisHostile.body.forEach(function(thisPart) {
                        if (thisPart.type == TOUGH && thisPart.boost) {
                            boostedTough = thisPart.boost;
                        } else if (thisPart.type == HEAL && thisPart.boost) {
                            damageReduction += HEAL_POWER * BOOSTS['heal'][thisPart.boost]['heal']
                        } else if (thisPart.type == HEAL) {
                            damageReduction += HEAL_POWER
                        }
                    });
                    //Look for healer creeps within 3 spaces of target creep for further subtractions
                    let nearbyFriendos = thisHostile.pos.findInRange(FIND_HOSTILE_CREEPS, 3, {
                        filter: (eCreep) => (!Memory.whiteList.includes(eCreep.owner.username))
                    });
                    for (let thisFriendo in nearbyFriendos) {
                        let friendRange = thisHostile.pos.getRangeTo(thisFriendo);
                        thisFriendo.body.forEach(function(thisPart) {
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
                        });
                    }

                    //Factor in damage reduction from Tough parts
                    if (boostedTough) {
                        flatTowerDamage = flatTowerDamage * BOOSTS['tough'][boostedTough]['damage']
                    }

                    //Display the calculated damage total under the target
                    let dColor = 'green';
                    if ((flatTowerDamage - damageReduction) <= 0) {
                        dColor = 'red';
                    }
                    new RoomVisual(thisRoom.name).text((flatTowerDamage - damageReduction).toString(), thisHostile.pos.x, thisHostile.pos.y, {color: dColor, font: 0.8}); 

                    //Determine if this beats the best
                    if ((flatTowerDamage - damageReduction) > damageRecord) {
                        damageRecord = (flatTowerDamage - damageReduction);
                        targetToShoot = thisHostile;
                    }
                }

                //if targetToShoot is defined, a valid target you can damage was found.
                if (targetToShoot) {
                    closestHostile = targetToShoot;
                }
            }

            //Heal only if the target isn't taking damage
            if (Memory.roomCreeps[thisRoom.name] && (!closestHostile || closestHostile.hits > (closestHostile.hitsMax - 500))) {
                if (Game.flags[thisRoom.name + "RoomOperator"]) {
                    powerCreep = tower.pos.findClosestByRange(FIND_MY_POWER_CREEPS);
                    if (powerCreep && powerCreep.hits < powerCreep.hitsMax) {
                        tower.heal(powerCreep);
                        didHeal = true;
                    }
                }
                let allCreeps = Memory.roomCreeps[thisRoom.name];
                if (allCreeps.length && !didHeal) {
                    allCreeps.sort(healCompare);
                    if (allCreeps[0].hits < allCreeps[0].hitsMax - 199) {
                        tower.heal(allCreeps[0]);
                        didHeal = true;
                    }
                }
            }

            if (!didHeal) {
                if (salvagerPos >= 0) {
                    //Verify that it's still not worth the time
                    //RETUNE - this could possibly spawn defenders if a big enough invader wave attacks
                    if (!closestHostile || determineCreepThreat(closestHostile, hostileCount.length)) {
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

                    if (tower.room.controller.level < 7) {                      
                        tower.attack(closestHostile);
                        if (range <= 5 && closestHostile.owner.username != 'Invader') {
                            //Too close for comfort
                            tower.room.controller.activateSafeMode();
                        }
                    } else {
                        tower.attack(closestHostile);
                    }
                }
            }
        } else if ((tower.energy > (tower.energyCapacity * 0.5)) && (Game.time % checkDelay == 0)) {
            var criticalRoads = tower.room.find(FIND_STRUCTURES, {
                filter: (structure) => (structure.structureType == STRUCTURE_ROAD && structure.hits < (structure.hitsMax / 2))
            });
            if (criticalRoads.length) {
                criticalRoads.sort(repairCompare);
                tower.repair(criticalRoads[0]);
            } else if (Memory.repairTarget[tower.room.name]) {
                let decayingRampart = Game.getObjectById(Memory.repairTarget[tower.room.name]);
                if (decayingRampart && decayingRampart.hits != decayingRampart.hitsMax) {
                    tower.repair(decayingRampart);
                } else {
                    //Bad target, let main handle reassignment
                    Memory.repairTarget[tower.room.name] = undefined;
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

function determineCreepThreat(eCreep, totalHostiles) {
    if ((eCreep.owner.username == 'Invader' || eCreep.name.indexOf('Drainer') >= 0) || (eCreep.hitsMax <= 1000 && totalHostiles <= 1)) {
        return false;
    } else {
        //Determine if this creep is boosted.
        eCreep.body.forEach(function(thisPart) {
            if (thisPart.boost) {
                return true;
            }
        });
        //unboosted threat, not a problem.
        return false;
    }
}

module.exports = tower_Operate;