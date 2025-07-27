var tool_generateBase = {
    // Constants for direction mappings and structure layouts
    DIRECTIONS: {
        1: { x: -1, y: 1 },   // Bottom-left
        3: { x: 1, y: 1 },    // Bottom-right  
        7: { x: -1, y: -1 },  // Top-left
        9: { x: 1, y: -1 }    // Top-right
    },

    // Pre-defined structure layouts for each direction to reduce switch complexity
    STRUCTURE_LAYOUTS: {
        1: {
            '3,3': { type: STRUCTURE_LINK, level: 6 },
            '3,4': STRUCTURE_OBSERVER,
            '3,5': { type: STRUCTURE_SPAWN, level: 7 },
            '3,6': STRUCTURE_LAB,
            '3,7': STRUCTURE_LAB,
            '4,3': STRUCTURE_POWER_SPAWN,
            '4,4': STRUCTURE_TOWER,
            '4,5': STRUCTURE_SPAWN,
            '4,6': STRUCTURE_TOWER,
            '4,7': STRUCTURE_LAB,
            '5,3': STRUCTURE_ROAD,
            '5,4': STRUCTURE_SPAWN,
            '5,6': STRUCTURE_TOWER,
            '5,7': { type: STRUCTURE_SPAWN, level: 7 },
            '6,3': STRUCTURE_ROAD,
            '6,4': STRUCTURE_STORAGE,
            '6,6': STRUCTURE_TOWER,
            '6,7': STRUCTURE_NUKER,
            '7,3': 'storageMiner',
            '7,4': STRUCTURE_ROAD,
            '7,6': STRUCTURE_TERMINAL,
            '7,7': STRUCTURE_FACTORY
        },
        3: {
            '3,3': 'storageMiner',
            '3,4': STRUCTURE_ROAD,
            '3,5': STRUCTURE_ROAD,
            '3,6': STRUCTURE_POWER_SPAWN,
            '3,7': { type: STRUCTURE_LINK, level: 6 },
            '4,3': STRUCTURE_ROAD,
            '4,4': STRUCTURE_STORAGE,
            '4,5': STRUCTURE_SPAWN,
            '4,6': STRUCTURE_TOWER,
            '4,7': STRUCTURE_OBSERVER,
            '5,3': STRUCTURE_ROAD,
            '5,4': STRUCTURE_TOWER,
            '5,6': STRUCTURE_TOWER,
            '5,7': { type: STRUCTURE_SPAWN, level: 7 },
            '6,3': STRUCTURE_TERMINAL,
            '6,4': STRUCTURE_TOWER,
            '6,6': STRUCTURE_TOWER,
            '6,7': STRUCTURE_LAB,
            '7,3': STRUCTURE_FACTORY,
            '7,4': STRUCTURE_NUKER,
            '7,6': STRUCTURE_LAB,
            '7,7': STRUCTURE_LAB
        },
        7: {
            '3,3': STRUCTURE_LAB,
            '3,4': STRUCTURE_LAB,
            '3,5': { type: STRUCTURE_SPAWN, level: 7 },
            '3,6': STRUCTURE_NUKER,
            '3,7': STRUCTURE_FACTORY,
            '4,3': STRUCTURE_LAB,
            '4,4': STRUCTURE_TOWER,
            '4,5': STRUCTURE_TOWER,
            '4,6': STRUCTURE_TOWER,
            '4,7': STRUCTURE_TERMINAL,
            '5,3': { type: STRUCTURE_SPAWN, level: 7 },
            '5,4': STRUCTURE_TOWER,
            '5,6': STRUCTURE_SPAWN,
            '5,7': STRUCTURE_ROAD,
            '6,3': STRUCTURE_OBSERVER,
            '6,4': STRUCTURE_TOWER,
            '6,6': STRUCTURE_STORAGE,
            '6,7': STRUCTURE_ROAD,
            '7,3': { type: STRUCTURE_LINK, level: 6 },
            '7,4': STRUCTURE_POWER_SPAWN,
            '7,6': STRUCTURE_ROAD,
            '7,7': 'storageMiner'
        },
        9: {
            '3,3': STRUCTURE_FACTORY,
            '3,4': STRUCTURE_TERMINAL,
            '3,5': STRUCTURE_ROAD,
            '3,6': STRUCTURE_ROAD,
            '3,7': 'storageMiner',
            '4,3': STRUCTURE_NUKER,
            '4,4': STRUCTURE_TOWER,
            '4,5': STRUCTURE_TOWER,
            '4,6': STRUCTURE_STORAGE,
            '4,7': STRUCTURE_ROAD,
            '5,3': { type: STRUCTURE_SPAWN, level: 7 },
            '5,4': STRUCTURE_TOWER,
            '5,6': STRUCTURE_SPAWN,
            '5,7': STRUCTURE_ROAD,
            '6,3': STRUCTURE_LAB,
            '6,4': STRUCTURE_TOWER,
            '6,6': STRUCTURE_TOWER,
            '6,7': STRUCTURE_POWER_SPAWN,
            '7,3': STRUCTURE_LAB,
            '7,4': STRUCTURE_LAB,
            '7,6': STRUCTURE_OBSERVER,
            '7,7': { type: STRUCTURE_LINK, level: 6 }
        }
    },

    run: function(thisRoom) {
        const terrain = new Room.Terrain(thisRoom.name);
        const roomSources = thisRoom.find(FIND_SOURCES);
        
        // Early return if no sources
        if (!roomSources.length) return;

        let bestCenterCoords, bestDirection, bestSourceID;

        // Step 1: Find best base location (cached in memory)
        if (!Memory.genBestCenterCoords[thisRoom.name]) {
            const result = this.findBestBaseLocation(thisRoom, terrain, roomSources);
            if (result) {
                Memory.genBestDirection[thisRoom.name] = result.direction;
                Memory.genBestCenterCoords[thisRoom.name] = result.centerCoords;
                Memory.genBestSourceID[thisRoom.name] = result.sourceID;
            }
        }

        // Early return if no suitable location found
        if (!Memory.genBestCenterCoords[thisRoom.name]) {
            console.log('No plannable sources located.');
            return;
        }

        // Load cached values
        bestCenterCoords = Memory.genBestCenterCoords[thisRoom.name];
        bestDirection = Memory.genBestDirection[thisRoom.name];
        bestSourceID = Memory.genBestSourceID[thisRoom.name];

        // Step 2: Generate base structures
        this.generateBaseStructures(thisRoom, terrain, roomSources, bestCenterCoords, bestDirection, bestSourceID);
    },

    findBestBaseLocation: function(thisRoom, terrain, roomSources) {
        let bestResult = null;
        let bestFreeSpace = 0;

        for (const source of roomSources) {
            const sourcePos = [source.pos.x, source.pos.y];
            const validDiagonals = this.getValidDiagonals(terrain, sourcePos);
            
            if (!validDiagonals.length) continue;

            const validDirections = this.filterValidDirections(terrain, sourcePos, validDiagonals);
            if (!validDirections.length) continue;

            const bestForSource = this.findBestDirection(terrain, sourcePos, validDirections);
            if (bestForSource && bestForSource.freeSpace > bestFreeSpace) {
                bestFreeSpace = bestForSource.freeSpace;
                bestResult = {
                    centerCoords: bestForSource.centerCoords,
                    direction: bestForSource.direction,
                    sourceID: source.id
                };
            }
        }

        return bestResult;
    },

    getValidDiagonals: function(terrain, sourceCoords) {
        const validDiagonals = [];
        const checks = [
            { dir: 7, x: -1, y: -1 },
            { dir: 9, x: 1, y: -1 },
            { dir: 3, x: 1, y: 1 },
            { dir: 1, x: -1, y: 1 }
        ];

        for (const check of checks) {
            if (terrain.get(sourceCoords[0] + check.x, sourceCoords[1] + check.y) !== TERRAIN_MASK_WALL) {
                validDiagonals.push(check.dir);
            }
        }

        return validDiagonals;
    },

    filterValidDirections: function(terrain, sourceCoords, validDiagonals) {
        return validDiagonals.filter(direction => {
            const bounds = this.getDirectionBounds(sourceCoords, direction, 5);
            
            // Check room edge boundaries
            if (bounds.xMin <= 1 || bounds.xMax >= 48 || bounds.yMin <= 1 || bounds.yMax >= 48) {
                return false;
            }

            // Check if all tiles in 5x5 area are free
            return this.isAreaFree(terrain, bounds);
        });
    },

    getDirectionBounds: function(sourceCoords, direction, size) {
        const offset = this.DIRECTIONS[direction];
        const xStart = sourceCoords[0] + (offset.x > 0 ? 1 : -size);
        const yStart = sourceCoords[1] + (offset.y > 0 ? 1 : -size);
        
        return {
            xMin: xStart,
            xMax: xStart + size - 1,
            yMin: yStart,
            yMax: yStart + size - 1
        };
    },

    isAreaFree: function(terrain, bounds) {
        for (let y = bounds.yMin; y <= bounds.yMax; y++) {
            for (let x = bounds.xMin; x <= bounds.xMax; x++) {
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) {
                    return false;
                }
            }
        }
        return true;
    },

    findBestDirection: function(terrain, sourceCoords, validDirections) {
        let bestResult = null;
        let mostSpace = 0;

        for (const direction of validDirections) {
            const offset = this.DIRECTIONS[direction];
            const centerCoords = [sourceCoords[0] + offset.x * 3, sourceCoords[1] + offset.y * 3];
            
            // Check 11x11 area around center
            const bounds = {
                xMin: centerCoords[0] - 5,
                xMax: centerCoords[0] + 5,
                yMin: centerCoords[1] - 5,
                yMax: centerCoords[1] + 5
            };

            // Skip if 11x11 area overlaps room edge
            if (bounds.xMin <= 1 || bounds.xMax >= 48 || bounds.yMin <= 1 || bounds.yMax >= 48) {
                continue;
            }

            const freeSpace = this.countFreeSpace(terrain, bounds);
            
            if (freeSpace > mostSpace) {
                mostSpace = freeSpace;
                bestResult = {
                    direction: direction,
                    centerCoords: centerCoords,
                    freeSpace: freeSpace
                };
            }
        }

        return bestResult;
    },

    countFreeSpace: function(terrain, bounds) {
        let freeSpace = 0;
        for (let y = bounds.yMin; y <= bounds.yMax; y++) {
            for (let x = bounds.xMin; x <= bounds.xMax; x++) {
                if (terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    freeSpace++;
                }
            }
        }
        return freeSpace;
    },

    generateBaseStructures: function(thisRoom, terrain, roomSources, bestCenterCoords, bestDirection, bestSourceID) {
        const startPos = [bestCenterCoords[0] - 5, bestCenterCoords[1] - 5];
        const notMainSource = roomSources.find(source => source.id !== bestSourceID);
        let totalExtensions = 0;

        // Generate core 5x5 structures and surrounding grid
        totalExtensions += this.generateCoreStructures(thisRoom, terrain, startPos, bestDirection, bestCenterCoords, notMainSource);

        // Generate additional extensions if needed
        this.generateAdditionalExtensions(thisRoom, terrain, bestCenterCoords, totalExtensions, notMainSource);

        // Generate links
        this.generateLinks(thisRoom, terrain, notMainSource);
    },

    generateCoreStructures: function(thisRoom, terrain, startPos, bestDirection, bestCenterCoords, notMainSource) {
        let totalExtensions = 0;
        let flipFlop = false;

        const layout = this.STRUCTURE_LAYOUTS[bestDirection];

        for (let y = 0; y <= 10; y++) {
            const isSpecialRow = y >= 3 && y <= 7;
            
            for (let x = 0; x <= 10; x++) {
                const currentPos = [startPos[0] + x, startPos[1] + y];
                
                if (isSpecialRow && x >= 3 && x <= 7) {
                    // Core 5x5 area
                    if (x === 5 && y === 5) {
                        // Dead center - always rampart and supply flag
                        thisRoom.createConstructionSite(currentPos[0], currentPos[1], STRUCTURE_RAMPART);
                        if (!Game.flags[thisRoom.name + "Supply"]) {
                            thisRoom.createFlag(currentPos[0], currentPos[1], thisRoom.name + "Supply");
                        }
                    } else {
                        const structureKey = `${x},${y}`;
                        const structureData = layout[structureKey];
                        
                        if (structureData) {
                            this.createStructureFromData(thisRoom, currentPos, structureData);
                        }
                    }
                } else {
                    // Grid pattern around core
                    totalExtensions += this.createGridStructure(thisRoom, terrain, currentPos, flipFlop, bestCenterCoords, notMainSource);
                }
                
                flipFlop = !flipFlop;
            }
        }

        return totalExtensions;
    },

    createStructureFromData: function(thisRoom, pos, structureData) {
        if (typeof structureData === 'string') {
            // Special case for flags
            if (structureData === 'storageMiner' && !Game.flags[thisRoom.name + "storageMiner"]) {
                thisRoom.createFlag(pos[0], pos[1], thisRoom.name + "storageMiner");
            }
        } else if (typeof structureData === 'object' && structureData.level) {
            // Level-dependent structure
            if (thisRoom.controller.level >= structureData.level) {
                thisRoom.createConstructionSite(pos[0], pos[1], structureData.type);
            }
        } else {
            // Regular structure
            thisRoom.createConstructionSite(pos[0], pos[1], structureData);
        }
    },

    createGridStructure: function(thisRoom, terrain, pos, flipFlop, bestCenterCoords, notMainSource) {
        let extensionsAdded = 0;
        
        if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) {
            return 0;
        }

        if (!this.isConnectedToCenter(pos[0], pos[1], bestCenterCoords[0], bestCenterCoords[1], terrain)) {
            return 0;
        }

        if (flipFlop) {
            // Extension/Rampart
            const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
            if (!roomPos.inRangeTo(thisRoom.controller, 2) && !roomPos.inRangeTo(notMainSource, 2)) {
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_EXTENSION);
                extensionsAdded = 1;
            }
            
            if (thisRoom.controller.level >= 7) {
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
            }
        } else {
            // Road/Rampart
            if (thisRoom.controller.level >= 7) {
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
            }
            if (thisRoom.controller.level >= 5) {
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_ROAD);
            }
        }
        
        return extensionsAdded;
    },

    generateAdditionalExtensions: function(thisRoom, terrain, bestCenterCoords, totalExtensions, notMainSource) {
        const targetExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][thisRoom.controller.level];
        
        if (totalExtensions >= targetExtensions) return;

        let loopDim = 6;
        let xOff = -6;
        let yOff = -6;
        let flipFlop = false;
        let moveStep = 1;

        while (totalExtensions < targetExtensions) {
            const currentPos = [bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff];
            
            if (this.isConnectedToCenter(currentPos[0], currentPos[1], bestCenterCoords[0], bestCenterCoords[1], terrain)) {
                if (terrain.get(currentPos[0], currentPos[1]) !== TERRAIN_MASK_WALL) {
                    if (flipFlop) {
                        const roomPos = new RoomPosition(currentPos[0], currentPos[1], thisRoom.name);
                        if (!roomPos.inRangeTo(thisRoom.controller, 2) && !roomPos.inRangeTo(notMainSource, 2)) {
                            thisRoom.createConstructionSite(currentPos[0], currentPos[1], STRUCTURE_EXTENSION);
                            totalExtensions++;
                        }
                        
                        if (thisRoom.controller.level >= 7) {
                            thisRoom.createConstructionSite(currentPos[0], currentPos[1], STRUCTURE_RAMPART);
                        }
                    } else {
                        if (thisRoom.controller.level >= 7) {
                            thisRoom.createConstructionSite(currentPos[0], currentPos[1], STRUCTURE_RAMPART);
                        }
                        if (thisRoom.controller.level >= 5) {
                            thisRoom.createConstructionSite(currentPos[0], currentPos[1], STRUCTURE_ROAD);
                        }
                    }
                }
            }
            
            flipFlop = !flipFlop;
            
            // Increment position using spiral pattern
            const result = this.incrementSpiralPosition(xOff, yOff, loopDim, moveStep);
            xOff = result.xOff;
            yOff = result.yOff;
            loopDim = result.loopDim;
            moveStep = result.moveStep;
            flipFlop = result.flipFlop !== undefined ? result.flipFlop : flipFlop;
        }
    },

    incrementSpiralPosition: function(xOff, yOff, loopDim, moveStep) {
        switch (moveStep) {
            case 1: // Top
                xOff += 1;
                if (xOff > loopDim) {
                    return { xOff: loopDim, yOff: loopDim * -1, loopDim, moveStep: 2, flipFlop: false };
                }
                break;
            case 2: // Right
                yOff += 1;
                if (yOff > loopDim) {
                    return { xOff: loopDim * -1, yOff: loopDim * -1, loopDim, moveStep: 3, flipFlop: false };
                }
                break;
            case 3: // Left
                yOff += 1;
                if (yOff > loopDim) {
                    return { xOff: loopDim * -1, yOff: loopDim, loopDim, moveStep: 4, flipFlop: false };
                }
                break;
            case 4: // Bottom
                xOff += 1;
                if (xOff > loopDim) {
                    return { xOff: (loopDim + 1) * -1, yOff: (loopDim + 1) * -1, loopDim: loopDim + 1, moveStep: 1, flipFlop: false };
                }
                break;
        }
        return { xOff, yOff, loopDim, moveStep };
    },

    generateLinks: function(thisRoom, terrain, notMainSource) {
        // Place upgradeMiner flag using harvester pathfinding
        if (!Game.flags[thisRoom.name + "upgradeMiner"]) {
            const harvesters = notMainSource.pos.findInRange(FIND_MY_CREEPS, 1, {
                filter: (creep) => (creep.memory.priority === 'harvester' && creep.memory.sourceLocation === notMainSource.id)
            });
            
            if (harvesters.length) {
                thisRoom.createFlag(harvesters[0].pos, thisRoom.name + "upgradeMiner");
            }
        }

        // Generate links near upgrade miner and controller
        if (Game.flags[thisRoom.name + "upgradeMiner"] && thisRoom.controller.level >= 5) {
            this.placeMinerLinks(thisRoom, terrain);
            this.placeUpgraderLinks(thisRoom, terrain);
        }
    },

    placeMinerLinks: function(thisRoom, terrain) {
        const flag = Game.flags[thisRoom.name + "upgradeMiner"];
        const linkCap = thisRoom.controller.level >= 7 ? 2 : 1;
        let placedLinks = 0;

        for (let y = -1; y <= 1 && placedLinks < linkCap; y++) {
            for (let x = -1; x <= 1 && placedLinks < linkCap; x++) {
                if (x === 0 && y === 0) continue; // Skip flag position
                
                const pos = [flag.pos.x + x, flag.pos.y + y];
                if (terrain.get(pos[0], pos[1]) !== TERRAIN_MASK_WALL) {
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                    placedLinks++;
                }
            }
        }
    },

    placeUpgraderLinks: function(thisRoom, terrain) {
        const controller = thisRoom.controller;
        let placedLinks = 0;

        // Search in expanding pattern around controller
        for (let range = 2; range <= 3 && placedLinks < 1; range++) {
            for (let y = -range; y <= range && placedLinks < 1; y++) {
                for (let x = -range; x <= range && placedLinks < 1; x++) {
                    if (Math.abs(x) !== range && Math.abs(y) !== range) continue; // Only check perimeter
                    
                    const pos = [controller.pos.x + x, controller.pos.y + y];
                    if (terrain.get(pos[0], pos[1]) !== TERRAIN_MASK_WALL) {
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                        placedLinks++;
                    }
                }
            }
        }
    },

    isConnectedToCenter: function(x, y, cenX, cenY, terrain) {
        // Check room bounds
        if (x <= 1 || x >= 48 || y <= 1 || y >= 48) {
            return false;
        }

        // Simple line-of-sight check to center
        let xPointer = x;
        let yPointer = y;

        while (xPointer !== cenX || yPointer !== cenY) {
            if (xPointer < cenX) {
                xPointer++;
            } else if (xPointer > cenX) {
                xPointer--;
            }

            if (yPointer < cenY) {
                yPointer++;
            } else if (yPointer > cenY) {
                yPointer--;
            }

            if (terrain.get(xPointer, yPointer) === TERRAIN_MASK_WALL) {
                return false;
            }
        }

        return true;
    }
};

module.exports = tool_generateBase;