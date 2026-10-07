// runtime.memory — Persistent memory initialization.


function memCheck() {
    if (!Memory.RoomsRun) {
        Memory.RoomsRun = [];
        console.log('RoomsRun Defaulted');
    }
    if (!Memory.NoSpawnNeeded) {
        Memory.NoSpawnNeeded = [];
        console.log('NoSpawnNeeded Defaulted');
    }
    if (!Memory.CurrentRoomEnergy) {
        Memory.CurrentRoomEnergy = [];
        console.log('CurrentRoomEnergy Defaulted');
    }
    if (!Memory.creepInQue) {
        Memory.creepInQue = [];
        console.log('creepInQue Defaulted');
    }
    if (!Memory.roomsUnderAttack) {
        Memory.roomsUnderAttack = [];
        console.log('roomsUnderAttack Defaulted');
    }
    if (!Memory.SKRoomsUnderAttack) {
        Memory.SKRoomsUnderAttack = [];
    }
    if (!Memory.FarRoomsUnderAttack) {
        Memory.FarRoomsUnderAttack = [];
    }
    if (!Memory.roomsPrepSalvager) {
        Memory.roomsPrepSalvager = [];
        console.log('roomsPrepSalvager Defaulted');
    }
    if (!Memory.RoomsAt5) {
        Memory.RoomsAt5 = [];
    }
    if (!Memory.ordersFilled) {
        Memory.ordersFilled = [];
    }
    Memory.whiteList = ['DomNomNom', 'Kotarou', 'ICED_COFFEE', 'demawi', 'o4kapuk', 'ben2', 'Jibol', 'szumi', 'Xist', 'Xolym', 'SirFrump', 'ART999', 'ThyReaper', 'Aundine', 'Fritee', 'Jumpp', 'mute', 'shadow_bird', 'szumi', 'TiffanyTrump', 'iceburg', 'Robalian', 'Digital'];
    if (!Memory.blockedRooms) {
        Memory.blockedRooms = ['E84N87', 'E83N88', 'E82N87', 'E83N86', 'E81N84', 'E82N83', 'E81N81', 'E84N82', 'E86N81', 'E88N81'];
    }
    if (!Memory.energyNeedRooms) {
        Memory.energyNeedRooms = [];
    }
    if (!Memory.scoutedMiningRooms) {
        Memory.scoutedMiningRooms = [];
    }
    if (!Memory.autoBuildRooms) {
        Memory.autoBuildRooms = [];
    }
    // Spawn tracking - initialize as object structure
    if (!Memory.isSpawning) {
        Memory.isSpawning = {};
    }
    //Boolean
    // "War mode" was removed (guards are sized to the recorded threat instead).
    delete Memory.warMode;
    if (Memory.guardType == null) {
        Memory.guardType = false;
    }
    if (Memory.postObserveTick == null) {
        Memory.postObserveTick = false;
    }
    //Decimal
    //Integer
    if (!Memory.attackDuration) {
        Memory.attackDuration = 0;
    }
    //Object
    if (!Memory.SKMineralTimers) {
        Memory.SKMineralTimers = new Object();
    }
    if (!Memory.ClosedRampartList) {
        Memory.ClosedRampartList = new Object();
    }
    /*if (!Memory.TerminalCollection) {
        Memory.TerminalCollection = new Object();
    }*/
    if (!Memory.FarClaimerNeeded) {
        Memory.FarClaimerNeeded = new Object();
    }
    if (!Memory.PriceList) {
        Memory.PriceList = new Object();
    }
    if (!Memory.sourceList) {
        Memory.sourceList = new Object();
    }
    if (!Memory.linkList) {
        Memory.linkList = new Object();
    }
    if (!Memory.mineralList) {
        Memory.mineralList = new Object();
    }
    if (!Memory.extractorList) {
        Memory.extractorList = new Object();
    }
    if (!Memory.powerSpawnList) {
        Memory.powerSpawnList = new Object();
    }
    if (!Memory.observationPointers) Memory.observationPointers = {};

    if (!Memory.observerList) {
        Memory.observerList = new Object();
    }
    if (!Memory.nukerList) {
        Memory.nukerList = new Object();
    }
    if (!Memory.towerNeedEnergy) {
        Memory.towerNeedEnergy = new Object();
    }
    if (!Memory.towerPickedTarget) {
        Memory.towerPickedTarget = new Object();
    }
    if (!Memory.mineralNeed) {
        Memory.mineralNeed = new Object();
    }
    if (!Memory.labList) {
        Memory.labList = new Object();
    }
    if (!Memory.repairTarget) {
        Memory.repairTarget = new Object();
    }
    if (!Memory.factoryList) {
        Memory.factoryList = new Object();
    }
    if (!Memory.flagCount) {
        Memory.flagCount = new Object();
        //Count by track
        //First 3 groupings should have 2 instances for 1 of each below
        //1- XGHO2/XGH2O/XUH2O
        //2- XZHO2/XZH2O/XKHO2
        //3- XLH2O/XLHO2/OH

        //4- G/GHO2/GH2O
        //5- ZHO2/ZH2O/KHO2
        //6- UH2O/LH2O/LHO2
        //7- UH/KO/GH/GO
        //8- ZH/ZO/LO/LH
        //9- UL/ZK/G/OH
        Memory.flagCount["1"] = 0;
        Memory.flagCount["2"] = 0;
        Memory.flagCount["3"] = 0;
        Memory.flagCount["4"] = 0;
        Memory.flagCount["5"] = 0;
        Memory.flagCount["6"] = 0;
        Memory.flagCount["7"] = 0;
        Memory.flagCount["8"] = 0;
        Memory.flagCount["9"] = 0;
        Memory.flagCount["NeedFlag"] = [];
    }
    if (!Memory.CPUAverages) {
        Memory.CPUAverages = new Object();
        Memory.CPUAverages.TotalCPU = new Object();
        Memory.CPUAverages.TotalCPU.ticks = 0;
        Memory.CPUAverages.TotalCPU.CPU = 0;
        Memory.CPUAverages.CreepCPU = new Object();
        Memory.CPUAverages.CreepCPU.ticks = 0;
        Memory.CPUAverages.CreepCPU.CPU = 0;
        Memory.CPUAverages.RemoteMiningCPU = new Object();
        Memory.CPUAverages.RemoteMiningCPU.ticks = 0;
        Memory.CPUAverages.RemoteMiningCPU.CPU = 0;
        Memory.CPUAverages.Pre5CPU = new Object();
        Memory.CPUAverages.Pre5CPU.ticks = 0;
        Memory.CPUAverages.Pre5CPU.CPU = 0;
        Memory.CPUAverages.Post5CPU = new Object();
        Memory.CPUAverages.Post5CPU.ticks = 0;
        Memory.CPUAverages.Post5CPU.CPU = 0;
        Memory.CPUAverages.SpawnCPU = new Object();
        Memory.CPUAverages.SpawnCPU.ticks = 0;
        Memory.CPUAverages.SpawnCPU.CPU = 0;
    }
    if (!Memory.mineralTotals) {
        Memory.mineralTotals = new Object();
        Memory.mineralTotals[RESOURCE_HYDROGEN] = 0;
        Memory.mineralTotals[RESOURCE_OXYGEN] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM] = 0;
        Memory.mineralTotals[RESOURCE_CATALYST] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM] = 0;

        Memory.mineralTotals[RESOURCE_HYDROXIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_KEANITE] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM_LEMERGITE] = 0;

        Memory.mineralTotals[RESOURCE_UTRIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_OXIDE] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_HYDRIDE] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_OXIDE] = 0;

        Memory.mineralTotals[RESOURCE_UTRIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_UTRIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_KEANIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_LEMERGIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_ZYNTHIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_GHODIUM_ALKALIDE] = 0;

        Memory.mineralTotals[RESOURCE_CATALYZED_UTRIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_UTRIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_KEANIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_KEANIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ACID] = 0;
        Memory.mineralTotals[RESOURCE_CATALYZED_GHODIUM_ALKALIDE] = 0;
    }

}

function cleanupCreepMemory() {
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
            //console.log('Clearing non-existing creep memory:', name);
        }
    }
}

let initialized = false;
function ensureInitialized() {
    if (initialized && Memory.frameworkVersion === 1) return;
    memCheck();
    if (!Memory.creeps) Memory.creeps = {};
    if (!Memory.powerCheckList) Memory.powerCheckList = {};
    // Discard scratch state left behind by a terminated legacy tick.
    Memory.RoomsRun = [];
    Memory.NoSpawnNeeded = [];
    Memory.CurrentRoomEnergy = [];
    // Unused here, but Nightmare writes into it without a guard; keep it so a rollback cannot crash.
    Memory.roomCreeps = {};
    Memory.frameworkVersion = 1;
    initialized = true;
}
module.exports = { memCheck, cleanupCreepMemory, ensureInitialized };
