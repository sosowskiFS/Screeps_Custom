// Recipe order is flag priority. Keep suffixes stable for existing room flags.
module.exports = [
    // Tier 1 - T3 Catalyzed compounds
    { flag: "XGHO2Producer", resource: RESOURCE_CATALYZED_GHODIUM_ALKALIDE, inputs: [RESOURCE_GHODIUM_ALKALIDE, RESOURCE_CATALYST] },
    { flag: "XGH2OProducer", resource: RESOURCE_CATALYZED_GHODIUM_ACID, inputs: [RESOURCE_GHODIUM_ACID, RESOURCE_CATALYST] },
    { flag: "XUH2OProducer", resource: RESOURCE_CATALYZED_UTRIUM_ACID, inputs: [RESOURCE_UTRIUM_ACID, RESOURCE_CATALYST] },

    // Tier 2 - T3 Catalyzed compounds
    { flag: "XZHO2Producer", resource: RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, inputs: [RESOURCE_ZYNTHIUM_ALKALIDE, RESOURCE_CATALYST] },
    { flag: "XZH2OProducer", resource: RESOURCE_CATALYZED_ZYNTHIUM_ACID, inputs: [RESOURCE_ZYNTHIUM_ACID, RESOURCE_CATALYST] },
    { flag: "XKHO2Producer", resource: RESOURCE_CATALYZED_KEANIUM_ALKALIDE, inputs: [RESOURCE_KEANIUM_ALKALIDE, RESOURCE_CATALYST] },

    // Tier 3 - T3 Catalyzed compounds
    { flag: "XLH2OProducer", resource: RESOURCE_CATALYZED_LEMERGIUM_ACID, inputs: [RESOURCE_LEMERGIUM_ACID, RESOURCE_CATALYST] },
    { flag: "XLHO2Producer", resource: RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, inputs: [RESOURCE_LEMERGIUM_ALKALIDE, RESOURCE_CATALYST] },
    { flag: "OHProducer(3)", resource: RESOURCE_HYDROXIDE, inputs: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN] },

    // Tier 4 - T2 compounds
    { flag: "GProducer(4)", resource: RESOURCE_GHODIUM, inputs: [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE] },
    { flag: "GHO2Producer", resource: RESOURCE_GHODIUM_ALKALIDE, inputs: [RESOURCE_GHODIUM_OXIDE, RESOURCE_HYDROXIDE] },
    { flag: "GH2OProducer", resource: RESOURCE_GHODIUM_ACID, inputs: [RESOURCE_GHODIUM_HYDRIDE, RESOURCE_HYDROXIDE] },

    // Tier 5 - T2 compounds
    { flag: "ZHO2Producer", resource: RESOURCE_ZYNTHIUM_ALKALIDE, inputs: [RESOURCE_ZYNTHIUM_OXIDE, RESOURCE_HYDROXIDE] },
    { flag: "ZH2OProducer", resource: RESOURCE_ZYNTHIUM_ACID, inputs: [RESOURCE_ZYNTHIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
    { flag: "KHO2Producer", resource: RESOURCE_KEANIUM_ALKALIDE, inputs: [RESOURCE_KEANIUM_OXIDE, RESOURCE_HYDROXIDE] },

    // Tier 6 - T2 compounds
    { flag: "UH2OProducer", resource: RESOURCE_UTRIUM_ACID, inputs: [RESOURCE_UTRIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
    { flag: "LH2OProducer", resource: RESOURCE_LEMERGIUM_ACID, inputs: [RESOURCE_LEMERGIUM_HYDRIDE, RESOURCE_HYDROXIDE] },
    { flag: "LHO2Producer", resource: RESOURCE_LEMERGIUM_ALKALIDE, inputs: [RESOURCE_LEMERGIUM_OXIDE, RESOURCE_HYDROXIDE] },

    // Tier 7 - T1 compounds
    { flag: "UHProducer", resource: RESOURCE_UTRIUM_HYDRIDE, inputs: [RESOURCE_UTRIUM, RESOURCE_HYDROGEN] },
    { flag: "GHProducer", resource: RESOURCE_GHODIUM_HYDRIDE, inputs: [RESOURCE_GHODIUM, RESOURCE_HYDROGEN] },
    { flag: "GOProducer", resource: RESOURCE_GHODIUM_OXIDE, inputs: [RESOURCE_GHODIUM, RESOURCE_OXYGEN] },
    { flag: "KOProducer", resource: RESOURCE_KEANIUM_OXIDE, inputs: [RESOURCE_KEANIUM, RESOURCE_OXYGEN] },

    // Tier 8 - T1 compounds
    { flag: "ZHProducer", resource: RESOURCE_ZYNTHIUM_HYDRIDE, inputs: [RESOURCE_ZYNTHIUM, RESOURCE_HYDROGEN] },
    { flag: "ZOProducer", resource: RESOURCE_ZYNTHIUM_OXIDE, inputs: [RESOURCE_ZYNTHIUM, RESOURCE_OXYGEN] },
    { flag: "LOProducer", resource: RESOURCE_LEMERGIUM_OXIDE, inputs: [RESOURCE_LEMERGIUM, RESOURCE_OXYGEN] },
    { flag: "LHProducer", resource: RESOURCE_LEMERGIUM_HYDRIDE, inputs: [RESOURCE_LEMERGIUM, RESOURCE_HYDROGEN] },

    // Tier 9 - Base compounds
    { flag: "ULProducer", resource: RESOURCE_UTRIUM_LEMERGITE, inputs: [RESOURCE_UTRIUM, RESOURCE_LEMERGIUM] },
    { flag: "ZKProducer", resource: RESOURCE_ZYNTHIUM_KEANITE, inputs: [RESOURCE_ZYNTHIUM, RESOURCE_KEANIUM] },
    { flag: "GProducer(9)", resource: RESOURCE_GHODIUM, inputs: [RESOURCE_ZYNTHIUM_KEANITE, RESOURCE_UTRIUM_LEMERGITE] },
    { flag: "OHProducer(9)", resource: RESOURCE_HYDROXIDE, inputs: [RESOURCE_HYDROGEN, RESOURCE_OXYGEN] }
];
