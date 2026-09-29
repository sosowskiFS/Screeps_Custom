// system.minerals — Screeps tick subsystem.
const { flagWeightCompare } = require('util.common');

function handleMineralFlagDistribution() {
    //If room lacks mineral flag, calculate what flag to give it
    if (Game.time % 5000 == 0 && Memory.flagCount["NeedFlag"].length) {
        let flagWeights = [
            { tier: 1, weight: Memory.flagCount["1"] },
            { tier: 2, weight: Memory.flagCount["2"] },
            { tier: 3, weight: Memory.flagCount["3"] },
            { tier: 4, weight: Memory.flagCount["4"] * 2 },
            { tier: 5, weight: Memory.flagCount["5"] * 2 },
            { tier: 6, weight: Memory.flagCount["6"] * 2 },
            { tier: 7, weight: Memory.flagCount["7"] * 2 },
            { tier: 8, weight: Memory.flagCount["8"] * 2 },
            { tier: 9, weight: Memory.flagCount["9"] * 2 },
        ];

        let SetCompleted = (Memory.flagCount["1"] == Memory.flagCount["2"] == Memory.flagCount["3"] == (Memory.flagCount["4"] * 2) == (Memory.flagCount["5"] * 2) == (Memory.flagCount["6"] * 2) == (Memory.flagCount["7"] * 2) == (Memory.flagCount["8"] * 2) == (Memory.flagCount["9"] * 2))

        flagWeights.sort(flagWeightCompare);

        if (SetCompleted) {
            Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XGHO2Producer");
            Memory.flagCount["NeedFlag"].splice(0, 1);
            Memory.flagCount["1"] = Memory.flagCount["1"] + 1;
        } else {
            switch (flagWeights[0].tier) {
                case 1:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XGHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["1"] = Memory.flagCount["1"] + 1;
                    break;
                case 2:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XZHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["2"] = Memory.flagCount["2"] + 1;
                    break;
                case 3:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "XLH2OProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["3"] = Memory.flagCount["3"] + 1;
                    break;
                case 4:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "GHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["4"] = Memory.flagCount["4"] + 1;
                    break;
                case 5:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "ZHO2Producer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["5"] = Memory.flagCount["5"] + 1;
                    break;
                case 6:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "UH2OProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["6"] = Memory.flagCount["6"] + 1;
                    break;
                case 7:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "UHProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["7"] = Memory.flagCount["7"] + 1;
                    break;
                case 8:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "ZHProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["8"] = Memory.flagCount["8"] + 1;
                    break;
                case 9:
                    Game.rooms[Memory.flagCount["NeedFlag"][0]].createFlag(2, 24, Memory.flagCount["NeedFlag"][0] + "ULProducer");
                    Memory.flagCount["NeedFlag"].splice(0, 1);
                    Memory.flagCount["9"] = Memory.flagCount["9"] + 1;
                    break;
            }
        }
    }
}

module.exports = { handleMineralFlagDistribution };
