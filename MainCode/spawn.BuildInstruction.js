var spawn_BuildInstruction = {
    run: function(spawn, instruction, params, energyIndex, thisRoom = '', params2 = '') {
        // Cache frequently used values
        const roomName = spawn.room.name;
        const currentRoomEnergy = Memory.CurrentRoomEnergy[energyIndex];
        
        switch (instruction) {
            case 'claim':
                const claimers = _.filter(Game.creeps, (creep) => 
                    creep.memory.priority == 'claimer' && creep.memory.homeRoom == roomName
                );
                if (claimers.length < 1) {
                    this.spawnClaimer(spawn, params, energyIndex, params2, roomName);
                }
                break;
                
            case 'vandalize':
                const vandals = _.filter(Game.creeps, (creep) => creep.memory.priority == 'vandal');
                if (vandals.length < 1) {
                    this.spawnVandal(spawn, energyIndex, roomName);
                }
                break;
                
            case 'helper':
                const helpers = _.filter(Game.creeps, (creep) => 
                    creep.memory.priority == 'helper' && creep.memory.homeRoom == roomName
                );
                if (helpers.length < 6) {
                    this.spawnHelper(spawn, params, energyIndex, params2, roomName);
                }
                break;
                
            case 'loot':
                const looters = _.filter(Game.creeps, (creep) => 
                    creep.memory.priority == 'looter' && creep.memory.homeRoom == roomName
                );
                if (looters.length < 3) {
                    this.spawnLooter(spawn, params, energyIndex, roomName);
                }
                break;
                
            case 'assault':
                this.handleAssaultSpawn(spawn, params, energyIndex, params2, roomName);
                break;
                
            case 'ranger':
            case 'ranger2':
            case 'PowerGuard':
                this.spawnRanger(spawn, instruction, params, energyIndex, params2, roomName);
                break;
                
            case 'powerGather':
                this.handlePowerGatherSpawn(spawn, params, energyIndex, roomName);
                break;
                
            case 'powerCollect':
                this.spawnPowerCollector(spawn, params, energyIndex, params2, roomName);
                break;
                
            case 'supplyEnergy':
                this.spawnEnergySupplier(spawn, params, energyIndex, params2, roomName);
                break;
                
            case 'farScout':
                this.spawnFarScout(spawn, energyIndex, roomName);
                break;
        }
    },
    
    // Optimized method to spawn claimers
    spawnClaimer: function(spawn, params, energyIndex, params2, roomName) {
        let tConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM];
        if (Memory.CurrentRoomEnergy[energyIndex] >= 2650) {
            tConfig = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM];
        }
        
        const configCost = calculateConfigCost(tConfig);
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            
            const creepMemory = {
                priority: 'claimer',
                destination: params,
                homeRoom: roomName
            };
            
            if (params2 !== '') {
                const creepPath = params2.split(";");
                if (creepPath.length) {
                    creepMemory.path = creepPath;
                }
            }
            
            spawn.spawnCreep(tConfig, 'claimer_' + spawn.name + '_' + Game.time, {
                memory: creepMemory
            });
            Memory.isSpawning = true;
            console.log('Claim executed from ' + roomName);
        }
    },
    
    // Optimized method to spawn vandals
    spawnVandal: function(spawn, energyIndex, roomName) {
        const configCost = calculateConfigCost([TOUGH, MOVE]);
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            spawn.spawnCreep([TOUGH, MOVE], 'vandal_' + spawn.name + '_' + Game.time, {
                memory: {
                    priority: 'vandal',
                    message: "Wew Lad"
                }
            });
            Memory.isSpawning = true;
            console.log('Vandalize executed from ' + roomName);
        }
    },
    
    // Optimized method to spawn helpers
    spawnHelper: function(spawn, params, energyIndex, params2, roomName) {
        let helperConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY];
        if (spawn.room.energyCapacityAvailable >= 2000) {
            helperConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY];
        }
        
        const configCost = calculateConfigCost(helperConfig);
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            
            const creepMemory = {
                priority: 'helper',
                destination: params,
                homeRoom: roomName,
                previousPriority: 'helper'
            };
            
            if (params2 !== '') {
                const creepPath = params2.split(";");
                if (creepPath.length) {
                    creepMemory.path = creepPath;
                }
            }
            
            spawn.spawnCreep(helperConfig, 'helper_' + spawn.name + '_' + Game.time, {
                memory: creepMemory
            });
            Memory.isSpawning = true;
            console.log('Helper executed from ' + roomName);
        }
    },
    
    // Optimized method to spawn looters
    spawnLooter: function(spawn, params, energyIndex, roomName) {
        const looterConfig = getLooterBuild(spawn.room.energyCapacityAvailable);
        const configCost = calculateConfigCost(looterConfig);
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            spawn.spawnCreep(looterConfig, 'looter_' + spawn.name + '_' + Game.time, {
                memory: {
                    priority: 'looter',
                    destination: params,
                    homeRoom: roomName
                }
            });
            Memory.isSpawning = true;
            console.log('Looter executed from ' + roomName);
        }
    },
    
    // Optimized method to handle assault spawning
    handleAssaultSpawn: function(spawn, params, energyIndex, params2, roomName) {
        const attackers = _.filter(Game.creeps, (creep) => 
            (creep.memory.priority == 'assattacker' || creep.memory.priority == 'assranger') && 
            creep.memory.homeRoom == roomName
        );
        const healerlessAttackers = _.filter(Game.creeps, (creep) => 
            (creep.memory.priority == 'assattacker' || creep.memory.priority == 'assranger') && 
            !creep.memory.healerID && 
            creep.memory.homeRoom == roomName && 
            !creep.memory.isReserved
        );
        const healers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'asshealer' && creep.memory.homeRoom == roomName
        );
        
        if (attackers.length < 2 && (attackers.length < healers.length || attackers.length == healers.length)) {
            this.spawnAssaultAttacker(spawn, params, energyIndex, params2, roomName);
        } else if (healers.length < 2 && healers.length < attackers.length && healerlessAttackers.length) {
            this.spawnAssaultHealer(spawn, params, energyIndex, roomName, healerlessAttackers[0]);
        }
    },
    
    // Optimized method to spawn assault attackers
    spawnAssaultAttacker: function(spawn, params, energyIndex, params2, roomName) {
        let priorityName = 'assattacker';
        let attackerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK];
        
        const doBoostFlag = Game.flags[roomName + "DoBoost"];
        const rangedStyleFlag = Game.flags[roomName + "RangedStyle"];
        const disassembleStyleFlag = Game.flags[roomName + "DisassembleStyle"];
        const meleeStyleFlag = Game.flags[roomName + "MeleeStyle"];
        
        if (doBoostFlag) {
            if (rangedStyleFlag) {
                priorityName = 'assranger';
                attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK];
            } else if (disassembleStyleFlag) {
                attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL];
            } else {
                // Melee Style
                attackerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            }
        }
        
        const configCost = calculateConfigCost(attackerConfig);
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            
            const creepMemory = {
                priority: priorityName,
                destination: params,
                homeRoom: roomName,
                isReserved: false,
                deathWarn: attackerConfig.length * 6,
                isGrouped: false
            };
            
            if (params2 !== '') {
                const creepPath = params2.split(";");
                if (creepPath.length) {
                    creepMemory.path = creepPath;
                }
            }
            
            spawn.spawnCreep(attackerConfig, 'attacker_' + spawn.name + '_' + Game.time, {
                memory: creepMemory
            });
            Memory.isSpawning = true;
            console.log('FUCK. SHIT. UP. ' + roomName);
            
            // Cycle through combat styles
            this.cycleCombatStyle(roomName, rangedStyleFlag, disassembleStyleFlag, meleeStyleFlag);
        }
    },
    
    // Optimized method to spawn assault healers
    spawnAssaultHealer: function(spawn, params, energyIndex, roomName, healerlessAttacker) {
        let healerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
        
        const doBoostFlag = Game.flags[roomName + "DoBoost"];
        if (doBoostFlag && spawn.room.energyCapacityAvailable >= 7860) {
            healerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
        } else if (doBoostFlag) {
            healerConfig = [TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
        }
        
        const configCost = calculateConfigCost(healerConfig);
        const attackerID = healerlessAttacker.id;
        
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex] && attackerID !== '') {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            spawn.spawnCreep(healerConfig, 'healer_' + spawn.name + '_' + Game.time, {
                memory: {
                    priority: 'asshealer',
                    destination: params,
                    homeRoom: roomName,
                    deathWarn: healerConfig.length * 6,
                    attackerID: attackerID
                }
            });
            Memory.isSpawning = true;
            healerlessAttacker.memory.isReserved = true;
            console.log('HEAL. SHIT. UP. ' + roomName);
        }
    },
    
    // Helper method to cycle combat styles
    cycleCombatStyle: function(roomName, rangedStyleFlag, disassembleStyleFlag, meleeStyleFlag) {
        if (rangedStyleFlag) {
            Game.rooms[roomName].createFlag(2, 20, roomName + "MeleeStyle");
            rangedStyleFlag.remove();
        } else if (disassembleStyleFlag) {
            Game.rooms[roomName].createFlag(2, 20, roomName + "MeleeStyle");
            disassembleStyleFlag.remove();
        } else if (meleeStyleFlag) {
            Game.rooms[roomName].createFlag(2, 20, roomName + "RangedStyle");
            meleeStyleFlag.remove();
        }
    },
    
    // Optimized method to spawn rangers
    spawnRanger: function(spawn, instruction, params, energyIndex, params2, roomName) {
        const rangers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == instruction && creep.memory.homeRoom == roomName
        );
        
        if (rangers.length < 1) {
            let rangerConfig = [TOUGH, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
            
            if (spawn.room.energyCapacityAvailable >= 2300) {
                rangerConfig = [RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL];
            }
            if (spawn.room.energyCapacityAvailable >= 4450) {
                rangerConfig = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,RANGED_ATTACK,ATTACK,ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL];
            }
            
            const configCost = calculateConfigCost(rangerConfig);
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] -= configCost;
                
                const creepMemory = {
                    priority: instruction,
                    destination: params,
                    deathWarn: rangerConfig.length * 6,
                    flagName: instruction,
                    homeRoom: roomName
                };
                
                if (params2 !== '') {
                    const creepPath = params2.split(";");
                    if (creepPath.length) {
                        creepMemory.path = creepPath;
                    }
                }
                
                spawn.spawnCreep(rangerConfig, 'ranger_' + spawn.name + '_' + Game.time, {
                    memory: creepMemory
                });
                Memory.isSpawning = true;
                console.log('Ranger ' + roomName);
            }
        }
    },
    
    // Optimized method to handle power gathering spawn
    handlePowerGatherSpawn: function(spawn, params, energyIndex, roomName) {
        const powerAttackers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'powerAttack' && creep.memory.homeRoom == roomName
        );
        const powerHealers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'powerHeal' && creep.memory.homeRoom == roomName
        );
        
        if (powerAttackers.length < 1) {
            this.spawnPowerAttacker(spawn, params, energyIndex, roomName);
        } else if (powerHealers.length < 2) {
            this.spawnPowerHealer(spawn, params, energyIndex, roomName, powerAttackers[0]);
        }
    },
    
    // Method to spawn power attackers
    spawnPowerAttacker: function(spawn, params, energyIndex, roomName) {
        const powerAttackConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK];
        const configCost = calculateConfigCost(powerAttackConfig);
        
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            spawn.spawnCreep(powerAttackConfig, 'powerA_' + spawn.name + '_' + Game.time, {
                memory: {
                    priority: 'powerAttack',
                    destination: params,
                    homeRoom: roomName,
                    deathWarn: powerAttackConfig.length * 4
                }
            });
            Memory.isSpawning = true;
            console.log('Power Mining - Attacker, ' + roomName);
        }
    },
    
    // Method to spawn power healers
    spawnPowerHealer: function(spawn, params, energyIndex, roomName, powerAttacker) {
        const healerConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
        const configCost = calculateConfigCost(healerConfig);
        const attackerID = powerAttacker ? powerAttacker.id : '';
        
        if (configCost <= Memory.CurrentRoomEnergy[energyIndex] && attackerID !== '') {
            Memory.CurrentRoomEnergy[energyIndex] -= configCost;
            spawn.spawnCreep(healerConfig, 'powerH_' + spawn.name + '_' + Game.time, {
                memory: {
                    priority: 'powerHeal',
                    destination: params,
                    homeRoom: roomName,
                    attackerID: attackerID,
                    deathWarn: healerConfig.length * 4
                }
            });
            Memory.isSpawning = true;
            console.log('Power Mining - Healer, ' + roomName);
        }
    },
    
    // Optimized method to spawn power collectors
    spawnPowerCollector: function(spawn, params, energyIndex, params2, roomName) {
        const powerCollectors = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'powerCollector' && creep.memory.homeRoom == roomName
        );
        
        if (powerCollectors.length < params2) {
            const powerCollectConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            const configCost = calculateConfigCost(powerCollectConfig);
            
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] -= configCost;
                spawn.spawnCreep(powerCollectConfig, 'powerC_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'powerCollector',
                        destination: params,
                        homeRoom: roomName,
                        deathWarn: powerCollectConfig.length * 4
                    }
                });
                Memory.isSpawning = true;
                console.log('Power Mining - Mule, ' + roomName);
            }
        }
    },
    
    // Optimized method to spawn energy suppliers
    spawnEnergySupplier: function(spawn, params, energyIndex, params2, roomName) {
        const energySuppliers = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'distantSupplier' && creep.memory.homeRoom == roomName
        );
        
        if (energySuppliers.length < params2) {
            const energySupplierConfig = [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            const configCost = calculateConfigCost(energySupplierConfig);
            
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] -= configCost;
                spawn.spawnCreep(energySupplierConfig, 'distSup_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'distantSupplier',
                        destination: params,
                        homeRoom: roomName,
                        deathWarn: energySupplierConfig.length * 4
                    }
                });
                Memory.isSpawning = true;
                console.log('Distant Supplier, ' + roomName);
            }
        }
    },
    
    // Optimized method to spawn far scouts
    spawnFarScout: function(spawn, energyIndex, roomName) {
        const mScouts = _.filter(Game.creeps, (creep) => 
            creep.memory.priority == 'farScout' && creep.memory.homeRoom == roomName
        );
        
        if (mScouts.length < 1) {
            const mConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE];
            const configCost = calculateConfigCost(mConfig);
            
            if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                Memory.CurrentRoomEnergy[energyIndex] -= configCost;
                spawn.spawnCreep(mConfig, 'farScout_' + spawn.name + '_' + Game.time, {
                    memory: {
                        priority: 'farScout',
                        homeRoom: roomName,
                        deathWarn: mConfig.length * 4
                    }
                });
                Memory.isSpawning = true;
                
                const mineScoutFlag = Game.flags[roomName + "MineScout"];
                if (mineScoutFlag) {
                    mineScoutFlag.remove();
                }
                console.log('Far Scout, ' + roomName);
            }
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

function getLooterBuild(energyCap) {
    var thisConfig = [];

    var ConfigCost = BODYPART_COST[CARRY] + BODYPART_COST[MOVE]

    while ((energyCap / ConfigCost) >= 1) {
        thisConfig.push(CARRY);
        thisConfig.push(MOVE);
        energyCap = energyCap - ConfigCost;
        if (thisConfig.length >= 50) {
            break;
        }
    }
    //thisConfig.sort();
    return thisConfig;
}

module.exports = spawn_BuildInstruction;