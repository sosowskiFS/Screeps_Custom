var spawn_BuildInstruction = {
    run: function(spawn, instruction, params, energyIndex, thisRoom = '', params2 = '') {
        switch (instruction) {
            case 'claim':
                var claimers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'claimer' && creep.memory.homeRoom == spawn.room.name);
                if (claimers.length < 1) {
                    if (params2 != '') {
                        //Claimer with defined path
                        var creepPath = params2.split(";");
                        if (creepPath.length) {
                            let configCost = calculateConfigCost([MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM]);
                            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                                spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM], 'claimer_' + spawn.name + '_' + Game.time, {
                                    memory: {
                                        priority: 'claimer',
                                        destination: params,
                                        homeRoom: spawn.room.name,
                                        path: creepPath
                                    }
                                });
                                Memory.isSpawning = true;
                                console.log('Claim executed from ' + spawn.room.name);
                                if (Game.flags[spawn.room.name + "ClaimThis"]) {
                                    Game.flags[spawn.room.name + "ClaimThis"].remove();
                                }
                            }
                        }
                    } else {
                        let configCost = calculateConfigCost([MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM]);
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep([MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM], 'claimer_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'claimer',
                                    homeRoom: spawn.room.name,
                                    destination: params
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Claim executed from ' + spawn.room.name);
                            if (Game.flags[spawn.room.name + "ClaimThis"]) {
                                Game.flags[spawn.room.name + "ClaimThis"].remove();
                            }
                        }
                    }
                }
                break;
            case 'vandalize':
                var vandals = _.filter(Game.creeps, (creep) => creep.memory.priority == 'vandal');
                if (vandals.length < 1) {
                    let configCost = calculateConfigCost([TOUGH, MOVE]);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep([TOUGH, MOVE], 'vandal_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'vandal',
                                message: "Wew Lad"
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Vandalize executed from ' + spawn.room.name);
                    }
                }
                break;
            case 'construct':
                var constructors = _.filter(Game.creeps, (creep) => creep.memory.priority == 'constructor' && creep.memory.homeRoom == spawn.room.name);
                if (constructors.length < 3) {
                    var constructorConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY];
                    if (spawn.room.energyCapacityAvailable >= 2000) {
                        constructorConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
                    }
                    let configCost = calculateConfigCost(constructorConfig);
                    if (params2 != '') {
                        var creepPath = params2.split(";");
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(constructorConfig, 'constructor_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'constructor',
                                    siteID: params,
                                    destination: thisRoom,
                                    homeRoom: spawn.room.name,
                                    path: creepPath
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Construct executed from ' + spawn.room.name);
                        }
                    } else {
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(constructorConfig, 'constructor_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'constructor',
                                    destination: thisRoom,
                                    homeRoom: spawn.room.name,
                                    siteID: params
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Construct executed from ' + spawn.room.name);
                        }
                    }

                }
                break;
            case 'removeKebab':
                //var kebabers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'removeKebab' && creep.memory.homeRoom == spawn.room.name);
                var kebabers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'removeKebab');
                if (kebabers.length < 1) {
                    var kebabConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    if (spawn.room.energyCapacityAvailable >= 3750) {
                        kebabConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(kebabConfig);
                    if (params2 != '') {
                        var creepPath = params2.split(";");
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(kebabConfig, 'kebab_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'removeKebab',
                                    destination: params,
                                    path: creepPath,
                                    homeRoom: spawn.room.name
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Kebab executed from ' + spawn.room.name);
                        }
                    } else {
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(kebabConfig, 'kebab_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'removeKebab',
                                    destination: params,
                                    homeRoom: spawn.room.name
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Kebab executed from ' + spawn.room.name);
                        }
                    }

                }
                break;
            case 'tDrain':
                var tDrainers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'TowerDrainer');
                if (tDrainers.length < 1) {
                    var drainCreep = [TOUGH, MOVE, MOVE, MOVE, HEAL, HEAL];
                    if (spawn.room.energyCapacityAvailable >= 1260) {
                        drainCreep = [TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL];
                    }
                    if (spawn.room.energyCapacityAvailable >= 6300) {
                        drainCreep = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    }
                    let configCost = calculateConfigCost(drainCreep);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(drainCreep, 'drainer_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'TowerDrainer',
                                destination: params,
                                homeRoom: spawn.room.name
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Tower Drain Executed from ' + spawn.room.name);
                    }
                }
                break;
            case 'helper':
                var helpers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'helper' && creep.memory.homeRoom == spawn.room.name);
                if (helpers.length < 6) {
                    var helperConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY];
                    if (spawn.room.energyCapacityAvailable >= 2000) {
                        helperConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
                    }
                    let configCost = calculateConfigCost(helperConfig);
                    if (params2 != '') {
                        var creepPath = params2.split(";");
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(helperConfig, 'helper_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'helper',
                                    destination: params,
                                    path: creepPath,
                                    homeRoom: spawn.room.name,
                                    previousPriority: 'helper'
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Helper executed from ' + spawn.room.name);
                        }
                    } else {
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(helperConfig, 'helper_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'helper',
                                    destination: params,
                                    homeRoom: spawn.room.name,
                                    previousPriority: 'helper'
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Helper executed from ' + spawn.room.name);
                        }
                    }

                }
                break;
            case 'loot':
                var looters = _.filter(Game.creeps, (creep) => creep.memory.priority == 'looter');
                if (looters.length < 3) {
                    var looterConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    if (spawn.room.energyCapacityAvailable >= 2500) {
                        looterConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(looterConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(looterConfig, 'looter_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'looter',
                                destination: params,
                                homeRoom: params2
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Looter executed from ' + spawn.room.name);
                    }
                }
                break;
            case 'trump':
                var trumps = _.filter(Game.creeps, (creep) => creep.memory.priority == 'trump');
                if (trumps.length < 3) {
                    var trumpConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    if (spawn.room.energyCapacityAvailable >= 1800) {
                        trumpConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                    let configCost = calculateConfigCost(trumpConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(trumpConfig, 'trump_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'trump',
                                destination: params,
                                homeRoom: params2
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('America will be great again thanks to ' + spawn.room.name);
                    }
                }
                break;
            case 'assault':
                var attackers = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'assattacker' || creep.memory.priority == 'assranger') && creep.memory.homeRoom == spawn.room.name);
                var healerlessAttackers = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'assattacker' || creep.memory.priority == 'assranger') && !creep.memory.healerID && creep.memory.homeRoom == spawn.room.name && !creep.memory.isReserved);
                var healers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'asshealer' && creep.memory.homeRoom == spawn.room.name);
                if (attackers.length < 2 && (attackers.length < healers.length || attackers.length == healers.length)) {
                    let priorityName = 'assattacker';
                    var attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE];
                    if (Game.flags[spawn.room.name + "DoBoost"]) {
                        //This expects tough/attack/move boost
                        if (Game.flags[spawn.room.name + "RangedStyle"]) {
                            priorityName = 'assranger';
                            attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                        } else if (Game.flags[spawn.room.name + "DisassembleStyle"]) {
                            attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK];
                        } else {
                            //Melee Style
                            attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK];
                        }
                    }
                    let configCost = calculateConfigCost(attackerConfig);
                    if (params2 != '') {
                        //Claimer with defined path
                        var creepPath = params2.split(";");
                        if (creepPath.length) {
                            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                                spawn.spawnCreep(attackerConfig, 'attacker_' + spawn.name + '_' + Game.time, {
                                    memory: {
                                        priority: priorityName,
                                        destination: params,
                                        path: creepPath,
                                        homeRoom: spawn.room.name,
                                        isReserved: false,
                                        isGrouped: false
                                    }
                                });
                                Memory.isSpawning = true;
                                console.log('FUCK. SHIT. UP. ' + spawn.room.name);
                            }
                        }
                    } else {
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(attackerConfig, 'attacker_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: priorityName,
                                    destination: params,
                                    homeRoom: spawn.room.name,
                                    isReserved: false,
                                    isGrouped: false
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('FUCK. SHIT. UP. ' + spawn.room.name);
                        }
                    }
                } else if (healers.length < 2 && healers.length < attackers.length && healerlessAttackers.length) {
                    var healerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    //Testing movement config
                    //var healerConfig = [TOUGH, MOVE];
                    if (Game.flags[spawn.room.name + "DoBoost"] && spawn.room.energyCapacityAvailable >= 8100) {
                        //assumes tough/move/heal boost
                        healerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[spawn.room.name + "DoBoost"]) {
                        healerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    }
                    let configCost = calculateConfigCost(healerConfig);
                    var attackerID = '';
                    if (healerlessAttackers.length) {
                        attackerID = healerlessAttackers[0].id
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex] && attackerID != '') {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(healerConfig, 'healer_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'asshealer',
                                    destination: params,
                                    homeRoom: spawn.room.name,
                                    attackerID: attackerID
                                }
                            });
                            Memory.isSpawning = true;
                            healerlessAttackers[0].memory.isReserved = true;
                            console.log('HEAL. SHIT. UP. ' + spawn.room.name);
                        }
                    }
                }
                break;
            case 'ranger':
                var rangers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'ranger' && creep.memory.homeRoom == spawn.room.name);
                if (rangers.length < 1) {
                    let priorityName = 'ranger';
                    //5
                    let rangerConfig = [TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                    if (spawn.room.energyCapacityAvailable >= 2300) {
                        rangerConfig = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
                    }
                    if (spawn.room.energyCapacityAvailable >= 4450) {
                        rangerConfig = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL];
                    }
                    let configCost = calculateConfigCost(rangerConfig);
                    if (params2 != '') {
                        //ranger with defined path
                        var creepPath = params2.split(";");
                        if (creepPath.length) {
                            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                                Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                                spawn.spawnCreep(rangerConfig, 'ranger_' + spawn.name + '_' + Game.time, {
                                    memory: {
                                        priority: priorityName,
                                        destination: params,
                                        path: creepPath,
                                        homeRoom: spawn.room.name
                                    }
                                });
                                Memory.isSpawning = true;
                                console.log('Ranger ' + spawn.room.name);
                            }
                        }
                    } else {
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(rangerConfig, 'ranger_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: priorityName,
                                    destination: params,
                                    homeRoom: spawn.room.name
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Ranger ' + spawn.room.name);
                        }
                    }
                }
                break;
            case 'distract':
                var distractors = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'distractor' && creep.memory.homeRoom == spawn.room.name));
                if (distractors.length < 1) {
                    var distractConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK];
                    let configCost = calculateConfigCost(distractConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(distractConfig, 'attacker_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'distractor',
                                destination: params,
                                homeRoom: spawn.room.name,
                                targetFlag: params2
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Keep em busy, ' + spawn.room.name);
                    }
                }
                break;
            case 'powerGather':
                var powerAttackers = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'powerAttack' && creep.memory.homeRoom == spawn.room.name));
                var powerHealers = _.filter(Game.creeps, (creep) => creep.memory.priority == 'powerHeal' && creep.memory.homeRoom == spawn.room.name);
                if (powerAttackers.length < 1) {
                    var powerAttackConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];
                    let configCost = calculateConfigCost(powerAttackConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(powerAttackConfig, 'powerA_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'powerAttack',
                                destination: params,
                                homeRoom: spawn.room.name,
                                deathWarn: _.size(powerAttackConfig) * 4
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Power Mining - Attacker, ' + spawn.room.name);
                    }
                } else if (powerHealers.length < 2) {
                    var healerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    var attackerID = '';
                    let configCost = calculateConfigCost(healerConfig);
                    if (powerAttackers[0]) {
                        attackerID = powerAttackers[0].id
                        if (configCost <= Memory.CurrentRoomEnergy[energyIndex] && attackerID != '') {
                            Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                            spawn.spawnCreep(healerConfig, 'powerH_' + spawn.name + '_' + Game.time, {
                                memory: {
                                    priority: 'powerHeal',
                                    destination: params,
                                    homeRoom: spawn.room.name,
                                    attackerID: attackerID,
                                    deathWarn: _.size(healerConfig) * 4
                                }
                            });
                            Memory.isSpawning = true;
                            console.log('Power Mining - Healer, ' + spawn.room.name);
                        }
                    }
                }
                break;
            case 'powerCollect':
                var powerCollectors = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'powerCollector' && creep.memory.homeRoom == spawn.room.name));
                if (powerCollectors.length < params2) {
                    var powerCollectConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(powerCollectConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(powerCollectConfig, 'powerC_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'powerCollector',
                                destination: params,
                                homeRoom: spawn.room.name,
                                deathWarn: _.size(powerCollectConfig) * 4
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Power Mining - Mule, ' + spawn.room.name);
                    }
                }
                break;
            case 'supplyEnergy':
                var energySuppliers = _.filter(Game.creeps, (creep) => (creep.memory.priority == 'distantSupplier' && creep.memory.homeRoom == spawn.room.name));
                if (energySuppliers.length < params2) {
                    let energySupplierConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
                    let configCost = calculateConfigCost(energySupplierConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(energySupplierConfig, 'distSup_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: 'distantSupplier',
                                destination: params,
                                homeRoom: spawn.room.name,
                                deathWarn: _.size(energySupplierConfig) * 4
                            }
                        });
                        Memory.isSpawning = true;
                        console.log('Distant Supplier, ' + spawn.room.name);
                    }
                }
                break;
        }
    }
};

function calculateConfigCost(bodyConfig) {
    var totalCost = 0;
    for (let thisPart of bodyConfig) {
        totalCost = totalCost + BODYPART_COST[thisPart];
    }
    return totalCost;
}

module.exports = spawn_BuildInstruction;