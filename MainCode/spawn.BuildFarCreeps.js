var spawn_BuildFarCreeps = {
    run: function(spawn, thisRoom, energyIndex) {
        if (!spawn.spawning && thisRoom.storage && Memory.roomsUnderAttack.indexOf(thisRoom.name) == -1) {
            let controlledCreeps = Game.creeps;

            let Flag25 = false;
            let Flag50 = false;
            let hasPower = false;
            if (thisRoom.storage.store[RESOURCE_POWER] && thisRoom.storage.store[RESOURCE_POWER] >= 100) {
                hasPower = true;
            }
            if (!hasPower && Game.flags[thisRoom.name + "25mCap"] && !Game.flags[thisRoom.name + "RunningAssault"]) {
                Flag25 = true;
            } else if (!hasPower && Game.flags[thisRoom.name + "50mCap"] && !Game.flags[thisRoom.name + "RunningAssault"]) {
                Flag25 = true;
                if (!Memory.powerCheckList[thisRoom.name]) {
                    Flag50 = true;
                }               
            }
            
            let eFarGuards = [];
            if (Memory.warMode) {
                eFarGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "eFarGuard");
            }

            let farMules = [];
            let farClaimers = [];
            let farMiners = [];

            if (Game.flags[thisRoom.name + "FarMining"]) {
                farMules = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
                farClaimers = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining"].pos.roomName);
                farMiners = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining");
            }

            let farGuards = [];
            if (Game.flags[thisRoom.name + "FarGuard"] || Game.flags[thisRoom.name + "FarGuardTEMP"]) {
                farGuards = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard");
            }

            let farMules2 = [];
            let farClaimers2 = [];
            let farMiners2 = [];
            if (Game.flags[thisRoom.name + "FarMining2"]) {
                farMules2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
                farClaimers2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining2"].pos.roomName);
                farMiners2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining2");
            }

            let farGuards2 = [];
            if (Game.flags[thisRoom.name + "FarGuard2"] || Game.flags[thisRoom.name + "FarGuard2TEMP"]) {
                farGuards2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard2");
            }

            let farMules3 = [];
            let farClaimers3 = [];
            let farMiners3 = [];
            if (!Flag50 && Game.flags[thisRoom.name + "FarMining3"]) {
                farMules3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
                farClaimers3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining3"].pos.roomName);
                farMiners3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining3");
            }

            let farGuards3 = [];
            if (!Flag50 && (Game.flags[thisRoom.name + "FarGuard3"] || Game.flags[thisRoom.name + "FarGuard3TEMP"])) {
                farGuards3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard3");
            }

            let farMules4 = [];
            let farClaimers4 = [];
            let farMiners4 = [];
            if (!Flag50 && Game.flags[thisRoom.name + "FarMining4"]) {
                farMules4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
                farClaimers4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining4"].pos.roomName);
                farMiners4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining4");
            }

            let farGuards4 = [];
            if (!Flag50 && (Game.flags[thisRoom.name + "FarGuard4"] || Game.flags[thisRoom.name + "FarGuard4TEMP"])) {
                farGuards4 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard4");
            }

            let farMules5 = [];
            let farClaimers5 = [];
            let farMiners5 = [];
            if (!Flag25 && Game.flags[thisRoom.name + "FarMining5"]) {
                farMules5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
                farClaimers5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining5"].pos.roomName);
                farMiners5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining5");
            }

            let farGuards5 = [];
            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard5"] || Game.flags[thisRoom.name + "FarGuard5TEMP"])) {
                farGuards5 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard5");
            }

            let farMules6 = [];
            let farClaimers6 = [];
            let farMiners6 = [];
            if (!Flag25 && Game.flags[thisRoom.name + "FarMining6"]) {
                farMules6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
                farClaimers6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining6"].pos.roomName);
                farMiners6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining6");
            }

            let farGuards6 = [];
            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard6"] || Game.flags[thisRoom.name + "FarGuard6TEMP"])) {
                farGuards6 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard6");
            }

            let farMules7 = [];
            let farClaimers7 = [];
            let farMiners7 = [];
            if (!Flag25 && Game.flags[thisRoom.name + "FarMining7"]) {
                farMules7 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining7");
                farClaimers7 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining7"].pos.roomName);
                farMiners7 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining7");
            }

            let farGuards7 = [];
            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard7"] || Game.flags[thisRoom.name + "FarGuard7TEMP"])) {
                farGuards7 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard7");
            }

            let farMules8 = [];
            let farClaimers8 = [];
            let farMiners8 = [];
            if (!Flag25 && Game.flags[thisRoom.name + "FarMining8"]) {
                farMules8 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining8");
                farClaimers8 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining8"].pos.roomName);
                farMiners8 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining8");
            }

            let farGuards8 = [];
            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard8"] || Game.flags[thisRoom.name + "FarGuard8TEMP"])) {
                farGuards8 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard8");
            }

            let farMules9 = [];
            let farClaimers9 = [];
            let farMiners9 = [];
            if (!Flag25 && Game.flags[thisRoom.name + "FarMining9"]) {
                farMules9 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMule' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining9");
                farClaimers9 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farClaimer' && creep.memory.homeRoom == thisRoom.name && creep.memory.destination == Game.flags[thisRoom.name + "FarMining9"].pos.roomName);
                farMiners9 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMining9");
            }

            let farGuards9 = [];
            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard9"] || Game.flags[thisRoom.name + "FarGuard9TEMP"])) {
                farGuards9 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farGuard' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarGuard9");
            }


            let farMineralMiners = [];
            if (Game.flags[thisRoom.name + "FarMineral"]) {
                farMineralMiners = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMineralMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMineral");
            }

            let farMineralMiners2 = [];
            if (Game.flags[thisRoom.name + "FarMineral2"]) {
                farMineralMiners2 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMineralMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMineral2");
            }

            let farMineralMiners3 = [];
            if (Game.flags[thisRoom.name + "FarMineral3"]) {
                farMineralMiners3 = _.filter(controlledCreeps, (creep) => creep.memory.priority == 'farMineralMiner' && creep.memory.homeRoom == thisRoom.name && creep.memory.targetFlag == thisRoom.name + "FarMineral3");
            }

            let farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE];

            //760 Points (Level 3)
            let farGuardConfig = [TOUGH, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, MOVE, HEAL];

            if (Memory.warMode) {
                if (Memory.guardType) {
                    //Ranged Guard
                    if (thisRoom.energyCapacityAvailable >= 5100) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 3100) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 2300) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1800) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1280) {
                        //1250 Points
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    }
                } else {
                    //Melee Guard
                    if (thisRoom.energyCapacityAvailable >= 4120) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 3430) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 2300) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1790) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1270) {
                        //1250 Points
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    }
                }
            } else {
                if (Memory.guardType) {
                    if (thisRoom.energyCapacityAvailable >= 1280) {
                        farGuardConfig = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL];
                    }
                } else {
                    if (thisRoom.energyCapacityAvailable >= 1790) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, HEAL];
                    } else if (thisRoom.energyCapacityAvailable >= 1270) {
                        farGuardConfig = [TOUGH, TOUGH, TOUGH, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, HEAL];
                    }
                }
            }

            var prioritizedRole = '';
            var roomTarget = '';
            var flagName = '';
            var storageID = '';
            var healTarget;

            var blockedRole = '';
            if (Memory.creepInQue.indexOf(thisRoom.name) >= 0) {
                var RoomPointer = Memory.creepInQue.indexOf(thisRoom.name)
                blockedRole = Memory.creepInQue[RoomPointer + 1];
            }

            if (Memory.warMode) {
                if (eFarGuards.length < 1 && Game.flags[thisRoom.name + "eFarGuard"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "eFarGuard"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "eFarGuard"].name;
                }
            }

            if ((Game.flags[thisRoom.name + "FarGuard"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuardTEMP"] && prioritizedRole == '') {
                if (farGuards.length < 1 && Game.flags[thisRoom.name + "FarGuard"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard"].name;
                }
            }

            if ((Game.flags[thisRoom.name + "FarGuard2"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard2"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard2TEMP"] && prioritizedRole == '') {
                if (farGuards2.length < 1 && Game.flags[thisRoom.name + "FarGuard2"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard2"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard2"].name;
                }
            }

            if (!Flag50 && (Game.flags[thisRoom.name + "FarGuard3"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard3"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard3TEMP"] && prioritizedRole == '') {
                if (farGuards3.length < 1 && Game.flags[thisRoom.name + "FarGuard3"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard3"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard3"].name;
                }
            }

            if (!Flag50 && (Game.flags[thisRoom.name + "FarGuard4"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard4"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard4TEMP"] && prioritizedRole == '') {
                if (farGuards4.length < 1 && Game.flags[thisRoom.name + "FarGuard4"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard4"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard4"].name;
                }
            }

            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard5"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard5"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard5TEMP"] && prioritizedRole == '') {
                if (farGuards5.length < 1 && Game.flags[thisRoom.name + "FarGuard5"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard5"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard5"].name;
                }
            }

            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard6"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard6"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard6TEMP"] && prioritizedRole == '') {
                if (farGuards6.length < 1 && Game.flags[thisRoom.name + "FarGuard6"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard6"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard6"].name;
                }
            }

            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard7"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard7"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard7TEMP"] && prioritizedRole == '') {
                if (farGuards7.length < 1 && Game.flags[thisRoom.name + "FarGuard7"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard7"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard7"].name;
                }
            }

            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard8"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard8"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard8TEMP"] && prioritizedRole == '') {
                if (farGuards8.length < 1 && Game.flags[thisRoom.name + "FarGuard8"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard8"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard8"].name;
                }
            }

            if (!Flag25 && (Game.flags[thisRoom.name + "FarGuard9"] && Memory.FarRoomsUnderAttack.indexOf(Game.flags[thisRoom.name + "FarGuard9"].pos.roomName) != -1) || Game.flags[thisRoom.name + "FarGuard9TEMP"] && prioritizedRole == '') {
                if (farGuards9.length < 1 && Game.flags[thisRoom.name + "FarGuard9"] && blockedRole != 'farGuard') {
                    prioritizedRole = 'farGuard';
                    roomTarget = Game.flags[thisRoom.name + "FarGuard9"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarGuard9"].name;
                }
            }

            var jobSpecific = undefined;

            if (Game.flags[thisRoom.name + "FarMining"] && prioritizedRole == '') {
                if (farMiners.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining"].name;
                }
            }



            if (Game.flags[thisRoom.name + "FarMining2"] && prioritizedRole == '') {
                if (farMiners2.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining2"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining2"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining2"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules2.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining2"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers2.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining2"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining2"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining2"].name;
                }
            }



            if (!Flag50 && Game.flags[thisRoom.name + "FarMining3"] && prioritizedRole == '') {
                if (farMiners3.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining3"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining3"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining3"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules3.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining3"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers3.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining3"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining3"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining3"].name;
                }
            }

            if (!Flag50 && Game.flags[thisRoom.name + "FarMining4"] && prioritizedRole == '') {
                if (farMiners4.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining4"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining4"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining4"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules4.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining4"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers4.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining4"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining4"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining4"].name;
                }
            }

            if (!Flag25 && Game.flags[thisRoom.name + "FarMining5"] && prioritizedRole == '') {
                if (farMiners5.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining5"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining5"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining5"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules5.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining5"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers5.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining5"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining5"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining5"].name;
                }
            }

            if (!Flag25 && Game.flags[thisRoom.name + "FarMining6"] && prioritizedRole == '') {
                if (farMiners6.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining6"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining6"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining6"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules6.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining6"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers6.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining6"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining6"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining6"].name;
                }
            }

            if (!Flag25 && Game.flags[thisRoom.name + "FarMining7"] && prioritizedRole == '') {
                if (farMiners7.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining7"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining7"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining7"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining7"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules7.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining7"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining7"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers7.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining7"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining7"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining7"].name;
                }
            }

            if (!Flag25 && Game.flags[thisRoom.name + "FarMining8"] && prioritizedRole == '') {
                if (farMiners8.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining8"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining8"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining8"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        if (Game.flags[thisRoom.name + "8Expensive"]) {
                            farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                        } else {
                            farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                        }
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining8"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules8.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining8"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining8"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers8.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining8"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining8"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining8"].name;
                }
            }

            if (!Flag25 && Game.flags[thisRoom.name + "FarMining9"] && prioritizedRole == '') {
                if (farMiners9.length < 1 && blockedRole != 'farMiner') {
                    prioritizedRole = 'farMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMining9"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining9"].name;
                    if (Game.flags[Game.flags[thisRoom.name + "FarMining9"].pos.roomName + "SKRoom"]) {
                        jobSpecific = "SKMiner";
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                    } else if (Game.flags[Game.flags[thisRoom.name + "FarMining9"].pos.roomName + "NoSKRoom"]) {
                        farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE, MOVE, MOVE, MOVE];
                    }
                } else if (farMules9.length < 1 && blockedRole != 'farMule') {
                    prioritizedRole = 'farMule';
                    roomTarget = Game.flags[thisRoom.name + "FarMining9"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining9"].name;
                    storageID = thisRoom.storage.id;
                } else if (farClaimers9.length < 1 && Memory.FarClaimerNeeded[Game.flags[thisRoom.name + "FarMining9"].pos.roomName] && blockedRole != 'farClaimer') {
                    prioritizedRole = 'farClaimer';
                    roomTarget = Game.flags[thisRoom.name + "FarMining9"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMining9"].name;
                }
            }

            if (Game.flags[thisRoom.name + "FarMineral"] && Memory.SKMineralTimers[Game.flags[thisRoom.name + "FarMineral"].pos.roomName] <= 0 && thisRoom.terminal && prioritizedRole == '') {
                if (farMineralMiners.length < 1 && blockedRole != 'farMineralMiner') {
                    prioritizedRole = 'farMineralMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMineral"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMineral"].name;
                    storageID = thisRoom.terminal.id;
                    farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                }
            }

            if (Game.flags[thisRoom.name + "FarMineral2"] && Memory.SKMineralTimers[Game.flags[thisRoom.name + "FarMineral2"].pos.roomName] <= 0 && thisRoom.terminal && prioritizedRole == '') {
                if (farMineralMiners2.length < 1 && blockedRole != 'farMineralMiner') {
                    prioritizedRole = 'farMineralMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMineral2"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMineral2"].name;
                    storageID = thisRoom.terminal.id;
                    farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                }
            }

            if (Game.flags[thisRoom.name + "FarMineral3"] && Memory.SKMineralTimers[Game.flags[thisRoom.name + "FarMineral3"].pos.roomName] <= 0 && thisRoom.terminal && prioritizedRole == '') {
                if (farMineralMiners3.length < 1 && blockedRole != 'farMineralMiner') {
                    prioritizedRole = 'farMineralMiner';
                    roomTarget = Game.flags[thisRoom.name + "FarMineral3"].pos.roomName;
                    flagName = Game.flags[thisRoom.name + "FarMineral3"].name;
                    storageID = thisRoom.terminal.id;
                    farMinerConfig = [WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL, HEAL];
                }
            }

            if (prioritizedRole != '') {
                if (prioritizedRole == 'farClaimer') {
                    var farClaimerConfig = getClaimerBuild(thisRoom.energyCapacityAvailable);
                    let configCost = calculateConfigCost(farClaimerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farClaimerConfig, 'reserver_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name,
                                deathWarn: _.size(farClaimerConfig) * 5,
                                targetFlag: flagName
                            }
                        });
                        Memory.FarClaimerNeeded[Game.flags[flagName].pos.roomName] = false;
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farMiner') {
                    let configCost = calculateConfigCost(farMinerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farMinerConfig, 'farMiner_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                fromSpawn: spawn.id,
                                homeRoom: thisRoom.name,
                                deathWarn: _.size(farMinerConfig) * 8,
                                targetFlag: flagName,
                                jobSpecific: jobSpecific,
                                nextReservationCheck: 0
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farMule') {
                    var farMuleConfig = getMuleBuild(thisRoom.energyCapacityAvailable, thisRoom);
                    let configCost = calculateConfigCost(farMuleConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farMuleConfig, 'farMule_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                homeRoom: thisRoom.name,
                                storageSource: storageID,
                                fromSpawn: spawn.id,
                                deathWarn: _.size(farMuleConfig) * 6,
                                targetFlag: flagName
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                } else if (prioritizedRole == 'farGuard') {
                    let configCost = calculateConfigCost(farGuardConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        var warnMulti = 5;
                        if (Memory.warMode) {
                            warnMulti = 6;
                        }
                        spawn.spawnCreep(farGuardConfig, 'guard_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                homeRoom: thisRoom.name,
                                fromSpawn: spawn.id,
                                deathWarn: _.size(farGuardConfig) * warnMulti,
                                targetFlag: flagName
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                    Memory.guardType = false;
                } else if (prioritizedRole == 'farMineralMiner') {
                    let configCost = calculateConfigCost(farMinerConfig);
                    if (configCost <= Memory.CurrentRoomEnergy[energyIndex]) {
                        Memory.CurrentRoomEnergy[energyIndex] = Memory.CurrentRoomEnergy[energyIndex] - configCost;
                        spawn.spawnCreep(farMinerConfig, 'mineralMiner_' + spawn.name + '_' + Game.time, {
                            memory: {
                                priority: prioritizedRole,
                                destination: roomTarget,
                                homeRoom: thisRoom.name,
                                fromSpawn: spawn.id,
                                storageSource: storageID,
                                deathWarn: _.size(farMinerConfig) * 5,
                                targetFlag: flagName
                            }
                        });
                        Memory.creepInQue.push(thisRoom.name, prioritizedRole, '', spawn.name);
                    }
                }
            }

        }
    }
}

function getClaimerBuild(energyCap) {
    var thisConfig = [];

    var ConfigCost = BODYPART_COST[CLAIM] + BODYPART_COST[MOVE]

    while ((energyCap / ConfigCost) >= 1) {
        thisConfig.push(CLAIM);
        thisConfig.push(MOVE);
        energyCap = energyCap - ConfigCost;
        if (thisConfig.length >= 8) {
            break;
        }
    }
    thisConfig.sort();
    return thisConfig;
}

function getMuleBuild(energyCap, thisRoom) {
    var thisConfig = [CARRY, MOVE, WORK];
    var ConfigCost = (BODYPART_COST[CARRY] * 2) + BODYPART_COST[MOVE];
    energyCap = energyCap - (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]);
    var partCap = 50;
    //initial : 1 move, 1 work, 1 carry
    //Add to each loop : 2 carry, 1 move

    while ((energyCap / ConfigCost) >= 1) {
        thisConfig.push(MOVE);
        thisConfig.push(CARRY);
        thisConfig.push(CARRY);
        energyCap = energyCap - ConfigCost;
        if (thisConfig.length >= partCap) {
            break;
        }
    }

    if (thisConfig.length > partCap) {
        while (thisConfig.length > partCap) {
            thisConfig.splice(0, 1);
        }
    }

    thisConfig.sort();
    return thisConfig;
}

function calculateConfigCost(bodyConfig) {
    var totalCost = 0;
    for (let thisPart of bodyConfig) {
        totalCost = totalCost + BODYPART_COST[thisPart];
    }
    return totalCost;
}

module.exports = spawn_BuildFarCreeps;