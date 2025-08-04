var tool_generateBase = {
    // Constants for direction mappings and structure layouts
    DIRECTIONS: {
        1: { x: -1, y: 1 },   // Bottom-left
        3: { x: 1, y: 1 },    // Bottom-right  
        7: { x: -1, y: -1 },  // Top-left
        9: { x: 1, y: -1 }    // Top-right
    },

    /* 
     * UNIFIED GENERATION AND VISUALIZATION SYSTEM:
     * To visualize base plans instead of placing construction sites:
     * 1. Place a flag named "VisualizeBase" in any room
     * 2. Optional: Add "_N" to the flag name to specify controller level (e.g., "VisualizeBase_6" for level 6)
     * 3. The system will automatically detect the flag and show structure placement using colored circles and symbols
     * 4. Remove the flag when done viewing to return to normal construction site generation
     * 
     * The same generation functions now handle both modes - no separate visualization code needed!
     */

    // Compact 3x3 core structure layouts for each direction
    STRUCTURE_LAYOUTS: {
        1: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid - 6 towers max
            '3,3': STRUCTURE_TOWER,
            '3,4': 'supply', // Supply flag position
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_SPAWN,
            '4,4': STRUCTURE_TOWER, // Tower in center
            '4,5': STRUCTURE_TOWER,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_TOWER
            // '5,5': left empty for creep movement/mining access
        },
        3: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid - 6 towers max
            '3,3': STRUCTURE_TOWER,
            '3,4': STRUCTURE_TOWER,
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_TOWER, 
            '4,4': 'supply', // Supply flag position in center
            '4,5': STRUCTURE_SPAWN,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_TOWER
            // '5,5': left empty for creep movement/mining access
        },
        7: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid - 6 towers max
            '3,3': STRUCTURE_TOWER,
            '3,4': STRUCTURE_TOWER,
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_TOWER,
            '4,4': 'supply', // Supply flag position in center
            '4,5': STRUCTURE_TOWER,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_SPAWN
            // '5,5': left empty for creep movement/mining access
        },
        9: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid - 6 towers max
            '3,3': STRUCTURE_TOWER,
            '3,4': STRUCTURE_TOWER,
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_SPAWN,
            '4,4': 'supply', // Supply flag position in center
            '4,5': STRUCTURE_TOWER,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_TOWER
            // '5,5': left empty for creep movement/mining access
        }
    },

    // Priority structures to place around the core (in order of priority)
    PRIORITY_STRUCTURES: [
        { type: STRUCTURE_SPAWN, level: 1, count: 3 },
        { type: STRUCTURE_TOWER, level: 3, count: 6 },
        { type: STRUCTURE_TERMINAL, level: 6, count: 1 },
        { type: STRUCTURE_OBSERVER, level: 8, count: 1 },
        { type: STRUCTURE_NUKER, level: 8, count: 1 },
        { type: STRUCTURE_POWER_SPAWN, level: 8, count: 1 },
        { type: STRUCTURE_FACTORY, level: 7, count: 1 }
    ],

    run: function(thisRoom) {
        const terrain = new Room.Terrain(thisRoom.name);
        const roomSources = thisRoom.find(FIND_SOURCES);
        
        // Early return if no sources
        if (!roomSources.length) return;

        // Initialize Memory.autoBuildRooms if it doesn't exist
        if (!Memory.autoBuildRooms) {
            Memory.autoBuildRooms = [];
        }
        
        // Initialize memory objects for base generation if they don't exist
        if (!Memory.genBestCenterCoords) {
            Memory.genBestCenterCoords = {};
        }
        if (!Memory.genBestDirection) {
            Memory.genBestDirection = {};
        }
        if (!Memory.genBestSourceID) {
            Memory.genBestSourceID = {};
        }

        let bestCenterCoords, bestDirection, bestSourceID;

        // Check if we should visualize instead of generate construction sites
        const visualizeBaseFlag = Game.flags["VisualizeBase"];
        const shouldVisualize = visualizeBaseFlag && visualizeBaseFlag.pos.roomName === thisRoom.name;

        // Step 1: Find best base location (cached in memory)
        if (!Memory.genBestCenterCoords[thisRoom.name]) {
            const result = this.findBestBaseLocation(thisRoom, terrain, roomSources);
            if (result) {
                Memory.genBestDirection[thisRoom.name] = result.direction;
                Memory.genBestCenterCoords[thisRoom.name] = result.centerCoords;
                Memory.genBestSourceID[thisRoom.name] = result.sourceID;
                
                // Add room to autoBuildRooms list if it's not already there (but not in visualization mode)
                if (!shouldVisualize && Memory.autoBuildRooms.indexOf(thisRoom.name) === -1) {
                    Memory.autoBuildRooms.push(thisRoom.name);
                    console.log(`Added ${thisRoom.name} to autoBuildRooms - suitable space found for base generation.`);
                }
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
        
        // Ensure room is in autoBuildRooms list if structures were generated successfully (but not in visualization mode)
        if (!shouldVisualize && Memory.autoBuildRooms.indexOf(thisRoom.name) === -1) {
            Memory.autoBuildRooms.push(thisRoom.name);
            console.log(`Added ${thisRoom.name} to autoBuildRooms - base structures generated.`);
        }
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
            const bounds = this.getDirectionBounds(sourceCoords, direction, 3);
            
            // Check room edge boundaries
            if (bounds.xMin <= 1 || bounds.xMax >= 48 || bounds.yMin <= 1 || bounds.yMax >= 48) {
                return false;
            }

            // Check if all tiles in 3x3 area are free
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
            const centerCoords = [sourceCoords[0] + offset.x * 2, sourceCoords[1] + offset.y * 2];
            
            // Check 7x7 area around center for extensions and other structures
            const bounds = {
                xMin: centerCoords[0] - 3,
                xMax: centerCoords[0] + 3,
                yMin: centerCoords[1] - 3,
                yMax: centerCoords[1] + 3
            };

            // Skip if 7x7 area overlaps room edge
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
        const notMainSource = roomSources.find(source => source.id !== bestSourceID);
        const mainSource = roomSources.find(source => source.id === bestSourceID);

        // Check if we should visualize instead of generate construction sites
        const visualizeBaseFlag = Game.flags["VisualizeBase"];
        const shouldVisualize = visualizeBaseFlag && visualizeBaseFlag.pos.roomName === thisRoom.name;
        
        let roomVis = null;
        let occupiedPositions = null;
        
        if (shouldVisualize) {
            roomVis = new RoomVisual(thisRoom.name);
            roomVis.clear();
            occupiedPositions = new Set();
            
            // Draw terrain overview for visualization
            this.drawTerrainOverview(roomVis, terrain, bestCenterCoords);
            console.log(`Visualizing base plan for ${thisRoom.name}`);
        }

        // Generate compact 3x3 core structures
        this.generateCoreStructures(thisRoom, terrain, bestCenterCoords, bestDirection, roomVis, occupiedPositions);

        // Generate storageMiner flag and storage adjacent to the core (not conflicting with it)
        this.generateStorageMinerAndStorage(thisRoom, terrain, mainSource, bestCenterCoords, bestDirection, roomVis, occupiedPositions);

        // Generate priority structures around the core
        this.generatePriorityStructures(thisRoom, terrain, bestCenterCoords, bestDirection, notMainSource, roomVis, occupiedPositions);

        // Generate extension grid around core and priority structures (labs will be placed during this process)
        this.generateExtensionGrid(thisRoom, terrain, bestCenterCoords, notMainSource, roomVis, occupiedPositions);

        // Generate links
        this.generateLinks(thisRoom, terrain, notMainSource, bestCenterCoords, mainSource, roomVis, occupiedPositions);
        
        if (shouldVisualize) {
            // Add legend for visualization
            this.drawLegend(roomVis);
            console.log(`Base plan visualization complete for ${thisRoom.name}`);
        }
    },

    generateCoreStructures: function(thisRoom, terrain, bestCenterCoords, bestDirection, roomVis = null, occupiedPositions = null) {
        const layout = this.STRUCTURE_LAYOUTS[bestDirection];
        
        // Generate the 3x3 core using the layout coordinates directly
        Object.keys(layout).forEach(structureKey => {
            const structureData = layout[structureKey];
            const [layoutX, layoutY] = structureKey.split(',').map(Number);
            
            // Transform layout coordinates (3,3 to 5,5) to world coordinates
            // Layout coordinates are relative to center, so we offset by the center position
            const worldX = bestCenterCoords[0] - 4 + layoutX; // -4 because layout uses 3,4,5 (center at 4)
            const worldY = bestCenterCoords[1] - 4 + layoutY;
            
            if (roomVis) {
                // Visualization mode
                console.log(`Visualizing ${structureData} from layout ${structureKey} at world coords (${worldX},${worldY})`);
                this.drawStructureVisual(roomVis, [worldX, worldY], structureData, 'core');
                if (occupiedPositions) {
                    occupiedPositions.add(`${worldX},${worldY}`);
                }
            } else {
                // Generation mode
                console.log(`Placing ${structureData} from layout ${structureKey} at world coords (${worldX},${worldY})`);
                this.createStructureFromData(thisRoom, [worldX, worldY], structureData);
            }
        });
    },

    generateStorageMinerAndStorage: function(thisRoom, terrain, mainSource, bestCenterCoords, bestDirection, roomVis = null, occupiedPositions = null) {
        if (!mainSource) return;

        // Define the 3x3 core boundaries to avoid conflicts
        const coreMinX = bestCenterCoords[0] - 1;
        const coreMaxX = bestCenterCoords[0] + 1;
        const coreMinY = bestCenterCoords[1] - 1;
        const coreMaxY = bestCenterCoords[1] + 1;
        
        // Find positions adjacent to the 3x3 core (outside it) that are closest to the main source
        const sourcePos = [mainSource.pos.x, mainSource.pos.y];
        const candidatePositions = [];
        
        if (roomVis) {
            // Draw the source for visualization
            roomVis.circle(sourcePos[0], sourcePos[1], {
                radius: 0.5,
                fill: '#ffff00',
                stroke: '#000000',
                strokeWidth: 0.1
            });
            roomVis.text('SOURCE', sourcePos[0], sourcePos[1] + 0.1, {
                color: '#000000',
                font: '0.4',
                align: 'center'
            });
        }
        
        // Check positions around the 3x3 core perimeter
        for (let y = coreMinY - 1; y <= coreMaxY + 1; y++) {
            for (let x = coreMinX - 1; x <= coreMaxX + 1; x++) {
                // Skip positions inside the 3x3 core
                if (x >= coreMinX && x <= coreMaxX && y >= coreMinY && y <= coreMaxY) continue;
                
                // Check if position is valid (not wall, within bounds)
                if (x <= 2 || x >= 47 || y <= 2 || y >= 47) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied
                if (roomVis && occupiedPositions) {
                    // In visualization mode, check occupied positions set
                    const posKey = `${x},${y}`;
                    if (occupiedPositions.has(posKey)) continue;
                } else if (!roomVis) {
                    // In generation mode, check for real structures/sites/flags
                    const roomPos = new RoomPosition(x, y, thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                }
                
                // Check if this position will have road accessibility based on checkerboard pattern
                // A position is road-accessible if at least one adjacent position would be a road
                let hasRoadAccess = false;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue; // Skip the position itself
                        
                        const adjX = x + dx;
                        const adjY = y + dy;
                        
                        // Check if adjacent position is valid and would be a road in checkerboard pattern
                        if (adjX > 2 && adjX < 47 && adjY > 2 && adjY < 47) {
                            if (terrain.get(adjX, adjY) !== TERRAIN_MASK_WALL) {
                                // This adjacent position would be a road if (adjX + adjY) % 2 !== 0
                                const wouldBeRoad = (adjX + adjY) % 2 !== 0;
                                if (wouldBeRoad) {
                                    hasRoadAccess = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (hasRoadAccess) break;
                }
                
                // Calculate distance to source for prioritization
                const distanceToSource = Math.sqrt(Math.pow(x - sourcePos[0], 2) + Math.pow(y - sourcePos[1], 2));
                candidatePositions.push({
                    pos: [x, y],
                    distance: distanceToSource,
                    hasRoadAccess: hasRoadAccess
                });
            }
        }
        
        if (candidatePositions.length === 0) {
            console.log(`No valid positions found for storageMiner around core at ${bestCenterCoords[0]},${bestCenterCoords[1]}`);
            return;
        }
        
        // Sort by road accessibility first, then by distance to source
        // Prioritize positions with road access, then by proximity to source
        candidatePositions.sort((a, b) => {
            if (a.hasRoadAccess && !b.hasRoadAccess) return -1;
            if (!a.hasRoadAccess && b.hasRoadAccess) return 1;
            return a.distance - b.distance;
        });
        
        const storageMinerPos = candidatePositions[0].pos;
        const hasRoadAccess = candidatePositions[0].hasRoadAccess;
        
        if (roomVis) {
            // Visualization mode
            this.drawStructureVisual(roomVis, storageMinerPos, 'storageMiner', 'core');
            if (occupiedPositions) {
                occupiedPositions.add(`${storageMinerPos[0]},${storageMinerPos[1]}`);
            }
            
            // Add visual indicator for road access
            if (hasRoadAccess) {
                roomVis.text('R', storageMinerPos[0] + 0.3, storageMinerPos[1] - 0.3, {
                    color: '#00ff00',
                    font: '0.3',
                    stroke: '#000000',
                    strokeWidth: 0.05
                });
            }
        } else {
            // Generation mode - Place storageMiner flag if it doesn't exist
            if (!Game.flags[thisRoom.name + "storageMiner"]) {
                thisRoom.createFlag(storageMinerPos[0], storageMinerPos[1], thisRoom.name + "storageMiner");
                console.log(`Placed storageMiner flag at ${storageMinerPos[0]},${storageMinerPos[1]} adjacent to core (road access: ${hasRoadAccess})`);
            }
        }
        
        // Find a position for storage next to the storageMiner, preferring positions closer to the core
        const storagePositions = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip storageMiner position
                
                const storagePos = [storageMinerPos[0] + x, storageMinerPos[1] + y];
                
                // Check if position is valid
                if (storagePos[0] <= 2 || storagePos[0] >= 47 || storagePos[1] <= 2 || storagePos[1] >= 47) continue;
                if (terrain.get(storagePos[0], storagePos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied and not the source
                if (storagePos[0] === sourcePos[0] && storagePos[1] === sourcePos[1]) continue;
                
                if (roomVis && occupiedPositions) {
                    // In visualization mode, check occupied positions set
                    const posKey = `${storagePos[0]},${storagePos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                } else if (!roomVis) {
                    // In generation mode, check for real structures/sites/flags
                    const roomPos = new RoomPosition(storagePos[0], storagePos[1], thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                }
                
                // Avoid placing storage inside the 3x3 core
                if (storagePos[0] >= coreMinX && storagePos[0] <= coreMaxX && 
                    storagePos[1] >= coreMinY && storagePos[1] <= coreMaxY) continue;
                
                // Calculate distance to core center for prioritization
                const distanceToCore = Math.sqrt(Math.pow(storagePos[0] - bestCenterCoords[0], 2) + Math.pow(storagePos[1] - bestCenterCoords[1], 2));
                storagePositions.push({
                    pos: storagePos,
                    distance: distanceToCore
                });
            }
        }
        
        if (storagePositions.length === 0) {
            console.log(`No valid position found for storage next to storageMiner at ${storageMinerPos[0]},${storageMinerPos[1]}`);
            return;
        }
        
        // Sort by distance to core and choose the closest position
        storagePositions.sort((a, b) => a.distance - b.distance);
        const finalStoragePos = storagePositions[0].pos;
        
        if (roomVis) {
            // Visualization mode
            this.drawStructureVisual(roomVis, finalStoragePos, STRUCTURE_STORAGE, 'core');
            if (occupiedPositions) {
                occupiedPositions.add(`${finalStoragePos[0]},${finalStoragePos[1]}`);
            }
            console.log(`Visualized storage at ${finalStoragePos[0]},${finalStoragePos[1]} next to storageMiner and core`);
            
            // Visualize potential access road
            //this.visualizeStorageMinerRoadAccess(roomVis, terrain, storageMinerPos, bestCenterCoords, occupiedPositions);
        } else {
            // Generation mode - Place storage here
            thisRoom.createConstructionSite(finalStoragePos[0], finalStoragePos[1], STRUCTURE_STORAGE);
            console.log(`Placed storage at ${finalStoragePos[0]},${finalStoragePos[1]} next to storageMiner and core`);
            
            // Ensure road accessibility for the storageMiner by placing a road adjacent to it
            // This guarantees access even if the extension grid doesn't naturally create one
            this.ensureStorageMinerRoadAccess(thisRoom, terrain, storageMinerPos, bestCenterCoords);
        }
    },

    ensureStorageMinerRoadAccess: function(thisRoom, terrain, storageMinerPos, bestCenterCoords) {
        // Check if there's already a road adjacent to the storage miner
        let hasAdjacentRoad = false;
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the storage miner position itself
                
                const adjX = storageMinerPos[0] + dx;
                const adjY = storageMinerPos[1] + dy;
                
                // Check if this adjacent position already has a road
                if (adjX > 2 && adjX < 47 && adjY > 2 && adjY < 47) {
                    const roomPos = new RoomPosition(adjX, adjY, thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    
                    const hasRoad = structures.some(s => s.structureType === STRUCTURE_ROAD) ||
                                  sites.some(s => s.structureType === STRUCTURE_ROAD);
                    
                    if (hasRoad) {
                        hasAdjacentRoad = true;
                        break;
                    }
                }
            }
            if (hasAdjacentRoad) break;
        }
        
        // If no adjacent road exists, place one in the best available position
        if (!hasAdjacentRoad) {
            const roadPositions = [];
            
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue; // Skip the storage miner position itself
                    
                    const adjX = storageMinerPos[0] + dx;
                    const adjY = storageMinerPos[1] + dy;
                    
                    // Check if this position is valid for a road
                    if (adjX <= 2 || adjX >= 47 || adjY <= 2 || adjY >= 47) continue;
                    if (terrain.get(adjX, adjY) === TERRAIN_MASK_WALL) continue;
                    
                    const roomPos = new RoomPosition(adjX, adjY, thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    
                    // Skip if position is already occupied
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                    
                    // Calculate distance to core center for prioritization (closer to core is better)
                    const distanceToCore = Math.sqrt(Math.pow(adjX - bestCenterCoords[0], 2) + Math.pow(adjY - bestCenterCoords[1], 2));
                    roadPositions.push({
                        pos: [adjX, adjY],
                        distance: distanceToCore
                    });
                }
            }
            
            if (roadPositions.length > 0) {
                // Sort by distance to core and choose the closest position
                roadPositions.sort((a, b) => a.distance - b.distance);
                const roadPos = roadPositions[0].pos;
                
                // Place road to ensure storage miner accessibility
                thisRoom.createConstructionSite(roadPos[0], roadPos[1], STRUCTURE_ROAD);
                console.log(`Placed access road at ${roadPos[0]},${roadPos[1]} for storageMiner accessibility`);
                
                // Add rampart if high enough level
                if (thisRoom.controller.level >= 2) {
                    thisRoom.createConstructionSite(roadPos[0], roadPos[1], STRUCTURE_RAMPART);
                }
            } else {
                console.log(`Warning: Could not place access road for storageMiner at ${storageMinerPos[0]},${storageMinerPos[1]}`);
            }
        }
    },

    generatePriorityStructures: function(thisRoom, terrain, bestCenterCoords, bestDirection, notMainSource, roomVis = null, occupiedPositions = null) {
        let structureCounts = {};
        
        // Initialize structure counts
        this.PRIORITY_STRUCTURES.forEach(priorityStruct => {
            structureCounts[priorityStruct.type] = 0;
        });
        
        // Count already placed structures from core
        const layout = this.STRUCTURE_LAYOUTS[bestDirection];
        Object.values(layout).forEach(structureData => {
            if (typeof structureData === 'string' && structureData !== 'supply' && structureData !== 'storageMiner') {
                if (structureCounts[structureData] !== undefined) {
                    structureCounts[structureData]++;
                }
            }
        });

        // Account for storage placed near source (not in priority list but affects counts)
        // Storage is already placed by generateStorageMinerAndStorage, so we don't need to place another

        // Place priority structures in expanding rings around the core
        let radius = 2;
        while (radius <= 8) {
            const positions = this.getRingPositions(bestCenterCoords, radius);
            
            for (const pos of positions) {
                // Skip if out of bounds
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                
                // Skip if wall or not connected
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                if (!this.isConnectedToCenter(pos[0], pos[1], bestCenterCoords[0], bestCenterCoords[1], terrain)) continue;
                
                // Check if position is already occupied
                if (roomVis && occupiedPositions) {
                    // In visualization mode, check occupied positions set
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                } else if (!roomVis) {
                    // In generation mode, check for real structures/sites/flags
                    const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                }
                
                // Try to place next priority structure
                for (const priorityStruct of this.PRIORITY_STRUCTURES) {
                    if (thisRoom.controller.level >= priorityStruct.level && 
                        structureCounts[priorityStruct.type] < priorityStruct.count) {
                        
                        if (roomVis) {
                            // Visualization mode
                            this.drawStructureVisual(roomVis, pos, priorityStruct.type, 'priority');
                            if (occupiedPositions) {
                                occupiedPositions.add(`${pos[0]},${pos[1]}`);
                            }
                        } else {
                            // Generation mode
                            thisRoom.createConstructionSite(pos[0], pos[1], priorityStruct.type);
                            
                            // Add rampart for defensive structures
                            if (thisRoom.controller.level >= 2) {
                                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                            }
                        }
                        
                        structureCounts[priorityStruct.type]++;
                        break;
                    }
                }
            }
            radius++;
        }
    },

    generateExtensionGrid: function(thisRoom, terrain, bestCenterCoords, notMainSource, roomVis = null, occupiedPositions = null) {
        const targetExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][thisRoom.controller.level];
        let extensionsPlaced = 0;
        
        if (!roomVis) {
            // Count existing extensions only in generation mode
            const existingExtensions = thisRoom.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            }).length;
            const plannedExtensions = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_EXTENSION
            }).length;
            
            extensionsPlaced = existingExtensions + plannedExtensions;
        }
        // In visualization mode, start from 0 to show full planned layout

        // Place extensions in proper checkerboard pattern around the base
        let radius = 2;
        let labsPlaced = false; // Track if we've placed lab clusters
        
        while (extensionsPlaced < targetExtensions && radius <= 15) {
            const positions = this.getRingPositions(bestCenterCoords, radius);
            
            // Try to place lab clusters in the middle rings (radius 5-7) before placing extensions
            if (!labsPlaced && radius >= 5 && radius <= 7 && thisRoom.controller.level >= 6) {
                labsPlaced = this.tryPlaceLabClustersInRing(thisRoom, terrain, bestCenterCoords, radius, roomVis, occupiedPositions);
            }
            
            for (const pos of positions) {
                if (extensionsPlaced >= targetExtensions) break;
                
                // Skip if out of bounds
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                
                // Skip if wall
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                if (!this.isConnectedToCenter(pos[0], pos[1], bestCenterCoords[0], bestCenterCoords[1], terrain)) continue;
                
                // Skip if too close to controller or non-main source
                const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                if (roomPos.inRangeTo(thisRoom.controller, 2)) continue;
                if (notMainSource && roomPos.inRangeTo(notMainSource, 2)) continue;
                
                // Skip if position already has structures
                if (roomVis && occupiedPositions) {
                    // In visualization mode, check occupied positions set
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                } else if (!roomVis) {
                    // In generation mode, check for real structures/sites/flags
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                }
                
                // Create proper checkerboard pattern based on coordinates
                // Use coordinate sum to determine if position should be extension or road
                const isExtensionTile = (pos[0] + pos[1]) % 2 === 0;
                
                if (isExtensionTile) {
                    // Extension position
                    if (roomVis) {
                        // Visualization mode
                        this.drawStructureVisual(roomVis, pos, STRUCTURE_EXTENSION, 'extension');
                        if (occupiedPositions) {
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                        }
                    } else {
                        // Generation mode
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_EXTENSION);
                        
                        if (thisRoom.controller.level >= 2) {
                            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                        }
                    }
                    extensionsPlaced++;
                } else {
                    // Road position - ensures connectivity
                    if (roomVis) {
                        // Visualization mode
                        this.drawStructureVisual(roomVis, pos, STRUCTURE_ROAD, 'road');
                        if (occupiedPositions) {
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                        }
                    } else {
                        // Generation mode
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_ROAD);
                        
                        if (thisRoom.controller.level >= 2) {
                            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                        }
                    }
                }
            }
            radius++;
        }
        
        console.log(`Extension generation complete: ${extensionsPlaced}/${targetExtensions} extensions placed`);
    },

    tryPlaceLabClustersInRing: function(thisRoom, terrain, bestCenterCoords, radius, roomVis = null, occupiedPositions = null) {
        const targetLabs = CONTROLLER_STRUCTURES[STRUCTURE_LAB][thisRoom.controller.level];
        
        let labsPlaced = 0;
        
        if (!roomVis) {
            // Count existing labs only in generation mode
            const existingLabs = thisRoom.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LAB
            }).length;
            const plannedLabs = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_LAB
            }).length;
            
            labsPlaced = existingLabs + plannedLabs;
        }
        // In visualization mode, start from 0 to show full planned layout
        
        if (labsPlaced >= targetLabs) return true; // Already have enough labs
        
        console.log(`Trying to place lab clusters at radius ${radius}, need ${targetLabs - labsPlaced} more labs`);
        
        // Define compact lab cluster patterns for runReaction efficiency
        // All labs in cluster must be within range 2 of each other for reactions
        const labClusterPatterns = [
            {
                // Compact T-shape cluster - optimal for reactions
                positions: [
                    // Center reactor lab
                    { x: 0, y: 0, type: 'reactor' },
                    // Input labs in cross pattern within range 2
                    { x: 1, y: 0, type: 'input' },     // Right
                    { x: -1, y: 0, type: 'input' },    // Left  
                    { x: 0, y: 1, type: 'input' },     // Down
                    { x: 0, y: -1, type: 'input' },    // Up
                    // Additional input labs at range 2
                    { x: 2, y: 0, type: 'input' },     // Far right
                    { x: -2, y: 0, type: 'input' },    // Far left
                    { x: 0, y: 2, type: 'input' },     // Far down
                    { x: 0, y: -2, type: 'input' },    // Far up
                    { x: 1, y: 1, type: 'input' },     // Diagonal
                ]
            },
            {
                // L-shaped cluster - alternative pattern
                positions: [
                    { x: 0, y: 0, type: 'reactor' },    // Reactor at corner
                    { x: 1, y: 0, type: 'input' },     // Right
                    { x: 2, y: 0, type: 'input' },     // Far right
                    { x: 0, y: 1, type: 'input' },     // Down
                    { x: 0, y: 2, type: 'input' },     // Far down
                    { x: 1, y: 1, type: 'input' },     // Diagonal
                    { x: -1, y: 0, type: 'input' },    // Left
                    { x: 0, y: -1, type: 'input' },    // Up
                    { x: 1, y: -1, type: 'input' },    // Up-right
                    { x: -1, y: 1, type: 'input' },    // Down-left
                ]
            }
        ];
        
        const ringPositions = this.getRingPositions(bestCenterCoords, radius);
        
        for (const centerPos of ringPositions) {
            if (labsPlaced >= targetLabs) break;
            
            // Try each cluster pattern at this position
            for (const pattern of labClusterPatterns) {
                if (labsPlaced >= targetLabs) break;
                
                // Check if we can place this cluster pattern
                const clusterPositions = [];
                let canPlaceCluster = true;
                
                for (const labPos of pattern.positions) {
                    const worldX = centerPos[0] + labPos.x;
                    const worldY = centerPos[1] + labPos.y;
                    
                    // Check bounds
                    if (worldX <= 2 || worldX >= 47 || worldY <= 2 || worldY >= 47) {
                        canPlaceCluster = false;
                        break;
                    }
                    
                    // Check terrain
                    if (terrain.get(worldX, worldY) === TERRAIN_MASK_WALL) {
                        canPlaceCluster = false;
                        break;
                    }
                    
                    // Check if position is already occupied
                    if (roomVis && occupiedPositions) {
                        // In visualization mode, check occupied positions set
                        const posKey = `${worldX},${worldY}`;
                        if (occupiedPositions.has(posKey)) {
                            canPlaceCluster = false;
                            break;
                        }
                    } else if (!roomVis) {
                        // In generation mode, check for real structures/sites/flags
                        const roomPos = new RoomPosition(worldX, worldY, thisRoom.name);
                        const structures = roomPos.lookFor(LOOK_STRUCTURES);
                        const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                        const flags = roomPos.lookFor(LOOK_FLAGS);
                        if (structures.length > 0 || sites.length > 0 || flags.length > 0) {
                            canPlaceCluster = false;
                            break;
                        }
                    }
                    
                    // Check road accessibility for each individual lab position
                    if (!this.checkLabRoadAccess(worldX, worldY, terrain)) {
                        canPlaceCluster = false;
                        console.log(`Lab at ${worldX},${worldY} lacks road access, rejecting cluster`);
                        break;
                    }
                    
                    clusterPositions.push({ x: worldX, y: worldY, type: labPos.type });
                }
                
                // Place the cluster if valid and all labs have road access
                if (canPlaceCluster && clusterPositions.length > 0) {
                    const labsToPlace = Math.min(clusterPositions.length, targetLabs - labsPlaced);
                    
                    for (let i = 0; i < labsToPlace; i++) {
                        const labPos = clusterPositions[i];
                        
                        if (roomVis) {
                            // Visualization mode
                            this.drawStructureVisual(roomVis, [labPos.x, labPos.y], STRUCTURE_LAB, 'lab');
                            if (occupiedPositions) {
                                occupiedPositions.add(`${labPos.x},${labPos.y}`);
                            }
                        } else {
                            // Generation mode
                            thisRoom.createConstructionSite(labPos.x, labPos.y, STRUCTURE_LAB);
                            
                            if (thisRoom.controller.level >= 2) {
                                thisRoom.createConstructionSite(labPos.x, labPos.y, STRUCTURE_RAMPART);
                            }
                        }
                        labsPlaced++;
                    }
                    
                    console.log(`${roomVis ? 'Visualized' : 'Placed'} lab cluster of ${labsToPlace} labs at ${centerPos[0]},${centerPos[1]} (radius ${radius})`);
                    
                    // If we've placed enough labs, return success
                    if (labsPlaced >= targetLabs) {
                        return true;
                    }
                }
            }
        }
        
        if (roomVis) {
            return labsPlaced > 0; // In visualization mode, return true if we visualized any labs
        } else {
            const existingLabs = thisRoom.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LAB
            }).length;
            const plannedLabs = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_LAB
            }).length;
            return (existingLabs + plannedLabs) > labsPlaced; // Return true if we placed any labs in generation mode
        }
    },

    checkLabRoadAccess: function(x, y, terrain) {
        // Check if this lab position has road access within the checkerboard pattern
        // Roads are placed where (x + y) % 2 !== 0 in the checkerboard pattern
        
        const adjacentRoadPositions = [];
        
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue; // Skip the lab position itself
                
                const adjX = x + dx;
                const adjY = y + dy;
                
                // Check if adjacent position is valid
                if (adjX > 2 && adjX < 47 && adjY > 2 && adjY < 47) {
                    // Check if position is passable terrain
                    if (terrain.get(adjX, adjY) !== TERRAIN_MASK_WALL) {
                        // This position would be a road if (adjX + adjY) % 2 !== 0 in checkerboard pattern
                        const wouldBeRoad = (adjX + adjY) % 2 !== 0;
                        if (wouldBeRoad) {
                            adjacentRoadPositions.push({ x: adjX, y: adjY });
                        }
                    }
                }
            }
        }
        
        // Lab has road access if at least one adjacent position would be a road
        const hasAccess = adjacentRoadPositions.length > 0;
        
        if (!hasAccess) {
            console.log(`Lab at ${x},${y} has no adjacent road positions in checkerboard pattern`);
        }
        
        return hasAccess;
    },

    getRingPositions: function(center, radius) {
        const positions = [];
        const [cx, cy] = center;
        
        // Generate positions in a ring around the center
        for (let x = cx - radius; x <= cx + radius; x++) {
            for (let y = cy - radius; y <= cy + radius; y++) {
                // Only include positions that are exactly at the specified radius
                const distance = Math.max(Math.abs(x - cx), Math.abs(y - cy));
                if (distance === radius) {
                    positions.push([x, y]);
                }
            }
        }
        
        return positions;
    },

    getDirection: function(centerCoords) {
        // This would need to be passed or stored, for now return a default
        // In practice, this should be passed from the calling function
        return 1; // Default direction
    },

    createStructureFromData: function(thisRoom, pos, structureData) {
        if (typeof structureData === 'string') {
            // Special case for flags
            if (structureData === 'storageMiner' && !Game.flags[thisRoom.name + "storageMiner"]) {
                thisRoom.createFlag(pos[0], pos[1], thisRoom.name + "storageMiner");
            } else if (structureData === 'supply' && !Game.flags[thisRoom.name + "Supply"]) {
                thisRoom.createFlag(pos[0], pos[1], thisRoom.name + "Supply");
                // Also add rampart at supply position
                if (thisRoom.controller.level >= 2) {
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                }
            } else if (structureData === STRUCTURE_TOWER) {
                // Towers require controller level 3
                if (thisRoom.controller.level >= 3) {
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_TOWER);
                }
            } else if (structureData === STRUCTURE_SPAWN) {
                // Spawns are available from level 1
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_SPAWN);
            } else {
                // Other regular structures - place without level check for now
                thisRoom.createConstructionSite(pos[0], pos[1], structureData);
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

    generateLinks: function(thisRoom, terrain, notMainSource, bestCenterCoords, mainSource, roomVis = null, occupiedPositions = null) {
        if (thisRoom.controller.level < 5) return; // Links available at level 5
        
        console.log(`Generating optimal 4-link system for ${thisRoom.name}`);
        
        // Count existing links
        const existingLinks = thisRoom.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;
        const plannedLinks = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_LINK
        }).length;
        
        let linksPlaced = existingLinks + plannedLinks;
        
        if (linksPlaced >= 4) {
            console.log(`Already have ${linksPlaced} links, skipping link generation`);
            return;
        }
        
        // 1. Place center link in the main base core (priority 1)
        if (linksPlaced < 4) {
            if (this.placeCenterLink(thisRoom, terrain, bestCenterCoords, roomVis, occupiedPositions)) {
                linksPlaced++;
            }
        }
        
        // 2. Place controller link for upgraders (priority 2)
        if (linksPlaced < 4) {
            if (this.placeControllerLink(thisRoom, terrain, roomVis, occupiedPositions)) {
                linksPlaced++;
            }
        }
        
        // 3 & 4. Place source links near the secondary source (priority 3 & 4)
        if (linksPlaced < 4 && notMainSource) {
            const sourceLinksNeeded = Math.min(2, 4 - linksPlaced);
            const sourceLinksPlaced = this.placeSourceLinks(thisRoom, terrain, notMainSource, sourceLinksNeeded, roomVis, occupiedPositions);
            linksPlaced += sourceLinksPlaced;
        }
        
        const expectedLinks = 4; // Center + upgrader + 2 source links
        console.log(`Link generation complete for ${thisRoom.name}: placed ${linksPlaced} of ${expectedLinks} expected links`);
    },

    placeCenterLink: function(thisRoom, terrain, bestCenterCoords, roomVis = null, occupiedPositions = null) {
        // Place a link in the center core area for central distribution
        const centerPositions = [
            [bestCenterCoords[0], bestCenterCoords[1]], // Exact center
            [bestCenterCoords[0] + 1, bestCenterCoords[1]], // Adjacent positions
            [bestCenterCoords[0] - 1, bestCenterCoords[1]],
            [bestCenterCoords[0], bestCenterCoords[1] + 1],
            [bestCenterCoords[0], bestCenterCoords[1] - 1],
        ];
        
        for (const pos of centerPositions) {
            // Check if position is valid
            if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
            if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
            
            // Check if position is not occupied
            if (roomVis && occupiedPositions) {
                // In visualization mode, check occupied positions set
                const posKey = `${pos[0]},${pos[1]}`;
                if (occupiedPositions.has(posKey)) continue;
            } else if (!roomVis) {
                // In generation mode, check for real structures/sites/flags
                const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                const structures = roomPos.lookFor(LOOK_STRUCTURES);
                const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                const flags = roomPos.lookFor(LOOK_FLAGS);
                if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
            }
            
            if (roomVis) {
                // Visualization mode
                this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
                if (occupiedPositions) {
                    occupiedPositions.add(`${pos[0]},${pos[1]}`);
                }
                console.log(`Visualized center link at ${pos[0]},${pos[1]}`);
            } else {
                // Generation mode - Place center link here
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                console.log(`Placed center link at ${pos[0]},${pos[1]}`);
                
                // Add rampart for protection
                if (thisRoom.controller.level >= 2) {
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                }
            }
            return true; // Successfully placed
        }
        
        console.log(`No valid position found for center link near ${bestCenterCoords[0]},${bestCenterCoords[1]}`);
        return false; // Failed to place
    },

    placeControllerLink: function(thisRoom, terrain, roomVis = null, occupiedPositions = null) {
        const controller = thisRoom.controller;
        
        // Search in expanding pattern around controller (range 2-3 for upgraders)
        for (let range = 2; range <= 3; range++) {
            for (let y = -range; y <= range; y++) {
                for (let x = -range; x <= range; x++) {
                    // Only check perimeter of each range
                    if (Math.abs(x) !== range && Math.abs(y) !== range) continue;
                    
                    const pos = [controller.pos.x + x, controller.pos.y + y];
                    
                    // Check if position is valid
                    if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                    if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                    
                    // Check if position is not occupied
                    if (roomVis && occupiedPositions) {
                        // In visualization mode, check occupied positions set
                        const posKey = `${pos[0]},${pos[1]}`;
                        if (occupiedPositions.has(posKey)) continue;
                    } else if (!roomVis) {
                        // In generation mode, check for real structures/sites/flags
                        const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                        const structures = roomPos.lookFor(LOOK_STRUCTURES);
                        const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                        const flags = roomPos.lookFor(LOOK_FLAGS);
                        if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                    }
                    
                    if (roomVis) {
                        // Visualization mode
                        this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
                        if (occupiedPositions) {
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                        }
                        console.log(`Visualized controller link at ${pos[0]},${pos[1]} near controller`);
                    } else {
                        // Generation mode - Place controller link here
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                        console.log(`Placed controller link at ${pos[0]},${pos[1]} near controller`);
                        
                        // Add rampart for protection
                        if (thisRoom.controller.level >= 2) {
                            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                        }
                    }
                    return true; // Successfully placed
                }
            }
        }
        
        console.log(`No valid position found for controller link near controller`);
        return false; // Failed to place
    },

    placeSourceLinks: function(thisRoom, terrain, notMainSource, linksNeeded, roomVis = null, occupiedPositions = null) {
        const sourcePos = [notMainSource.pos.x, notMainSource.pos.y];
        let linksPlaced = 0;
        
        // Find positions around the source, leaving space for miners
        const linkPositions = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip source position
                
                const pos = [sourcePos[0] + x, sourcePos[1] + y];
                
                // Check if position is valid
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied
                if (roomVis && occupiedPositions) {
                    // In visualization mode, check occupied positions set
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                } else if (!roomVis) {
                    // In generation mode, check for real structures/sites/flags
                    const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                }
                
                linkPositions.push(pos);
            }
        }
        
        // Place links, but leave at least one free space for miners
        const maxLinksToPlace = Math.min(linksNeeded, linkPositions.length - 1);
        
        for (let i = 0; i < maxLinksToPlace && linksPlaced < linksNeeded; i++) {
            const pos = linkPositions[i];
            
            if (roomVis) {
                // Visualization mode
                this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
                if (occupiedPositions) {
                    occupiedPositions.add(`${pos[0]},${pos[1]}`);
                }
                console.log(`Visualized source link ${linksPlaced + 1} at ${pos[0]},${pos[1]} near secondary source`);
            } else {
                // Generation mode
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                console.log(`Placed source link ${linksPlaced + 1} at ${pos[0]},${pos[1]} near secondary source`);
                
                // Add rampart for protection
                if (thisRoom.controller.level >= 2) {
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                }
            }
            
            linksPlaced++;
        }
        
        if (linksPlaced < linksNeeded) {
            console.log(`Only placed ${linksPlaced} of ${linksNeeded} source links - not enough free positions`);
        }
        
        return linksPlaced; // Return actual number of links placed
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
    },

    generateLabClusters: function(thisRoom, terrain, bestCenterCoords) {
        if (thisRoom.controller.level < 6) return; // Labs available at level 6
        
        const targetLabs = CONTROLLER_STRUCTURES[STRUCTURE_LAB][thisRoom.controller.level];
        let labsPlaced = 0;
        
        // Count existing labs
        const existingLabs = thisRoom.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_LAB
        }).length;
        const plannedLabs = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_LAB
        }).length;
        
        labsPlaced = existingLabs + plannedLabs;
        
        if (labsPlaced >= targetLabs) return; // Already have enough labs
        
        console.log(`Generating lab clusters, need ${targetLabs - labsPlaced} more labs`);
        
        // Define compact lab cluster patterns for runReaction efficiency
        // Pattern creates accessible labs while maintaining reaction range requirements
        const labClusterPatterns = [
            {
                // L-shaped cluster that keeps all labs accessible
                positions: [
                    // Bottom row - reactor and input labs
                    { x: 0, y: 0, type: 'reactor' },    // Reactor at bottom left
                    { x: 1, y: 0, type: 'input' },     // Input lab to right of reactor
                    { x: 2, y: 0, type: 'input' },     // Input lab further right
                    
                    // Top row - input labs within range 2 of reactor
                    { x: 0, y: -1, type: 'input' },    // Input lab above reactor
                    { x: 1, y: -1, type: 'input' },    // Input lab above and right
                    { x: 0, y: -2, type: 'input' },    // Input lab 2 up from reactor
                    
                    // Side column - more input labs within range 2
                    { x: -1, y: 0, type: 'input' },    // Input lab to left of reactor
                    { x: -1, y: -1, type: 'input' },   // Input lab up and left
                    { x: -2, y: 0, type: 'input' },    // Input lab 2 left from reactor
                    { x: 1, y: 1, type: 'input' },     // Input lab down and right
                ]
            }
        ];
        
        // Search for suitable locations at increasing distances from core
        let radius = 8; // Start further out to avoid interfering with core structures
        
        while (labsPlaced < targetLabs && radius <= 15) {
            const positions = this.getRingPositions(bestCenterCoords, radius);
            
            for (const centerPos of positions) {
                if (labsPlaced >= targetLabs) break;
                
                // Try to place a lab cluster at this position
                for (const pattern of labClusterPatterns) {
                    if (labsPlaced >= targetLabs) break;
                    
                    // Check if we can place this pattern here
                    const clusterPositions = [];
                    let canPlaceCluster = true;
                    
                    for (const labPos of pattern.positions) {
                        const worldX = centerPos[0] + labPos.x;
                        const worldY = centerPos[1] + labPos.y;
                        
                        // Check bounds
                        if (worldX <= 2 || worldX >= 47 || worldY <= 2 || worldY >= 47) {
                            canPlaceCluster = false;
                            break;
                        }
                        
                        // Check terrain
                        if (terrain.get(worldX, worldY) === TERRAIN_MASK_WALL) {
                            canPlaceCluster = false;
                            break;
                        }
                        
                        // Check if position is occupied
                        const posKey = `${worldX},${worldY}`;
                        if (occupiedPositions.has(posKey)) {
                            canPlaceCluster = false;
                            break;
                        }
                        
                        // Check connectivity to center
                        if (!this.isConnectedToCenter(worldX, worldY, bestCenterCoords[0], bestCenterCoords[1], terrain)) {
                            canPlaceCluster = false;
                            break;
                        }
                        
                        clusterPositions.push({ pos: [worldX, worldY], type: labPos.type });
                    }
                    
                    // If we can place the cluster, do it
                    if (canPlaceCluster) {
                        let labsInThisCluster = 0;
                        for (let i = 0; i < clusterPositions.length && labsPlaced < targetLabs; i++) {
                            const { pos, type } = clusterPositions[i];
                            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LAB);
                            labsPlaced++;
                            labsInThisCluster++;
                            
                            // Add rampart for protection
                            if (thisRoom.controller.level >= 2) {
                                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                            }
                        }
                        
                        console.log(`Placed lab cluster of ${labsInThisCluster} labs at radius ${radius}, total labs: ${labsPlaced}`);
                        
                        // Move to next radius to spread out clusters
                        if (labsPlaced < targetLabs) {
                            radius += 2; // Skip ahead to avoid clustering too close
                        }
                        break; // Move to next center position
                    }
                }
            }
            radius++;
        }
        
        console.log(`Lab cluster generation complete, placed ${labsPlaced} total labs`);
    },

    drawLegend: function(roomVis) {
        // Position legend in middle left of screen
        const legendX = 3;
        const legendY = 20; // Middle of the room (room is 50x50)
        
        // Calculate proper background size based on content
        const backgroundWidth = 10;
        const backgroundHeight = 15;
        
        // Background for legend
        roomVis.rect(legendX - 0.5, legendY - 1, backgroundWidth, backgroundHeight, {
            fill: '#000000',
            opacity: 0.7,
            stroke: '#ffffff',
            strokeWidth: 0.1
        });
        
        // Title
        roomVis.text("Base Generation Legend", legendX, legendY, { 
            color: '#ffffff', 
            font: 0.6, 
            stroke: '#000000', 
            strokeWidth: 0.1 
        });
        
        let currentY = legendY + 1.5;
        
        // Helper function to draw legend entry with matching icon
        const drawLegendEntry = (structureType, label, specialText = null) => {
            // Draw the same icon as used in visualization
            this.drawLegendIcon(roomVis, legendX, currentY, structureType);
            
            // Draw the label - left aligned with proper spacing from icon
            roomVis.text(label, legendX + 1.2, currentY + 0.1, { 
                color: '#ffffff', 
                font: 0.4,
                align: 'left'
            });
            
            // Add special text if provided (like link types)
            if (specialText) {
                roomVis.text(specialText, legendX + 1.2, currentY + 0.5, { 
                    color: '#cccccc', 
                    font: 0.3,
                    align: 'left'
                });
            }
            
            currentY += specialText ? 1.2 : 0.8;
        };
        
        // Core structures
        drawLegendEntry(STRUCTURE_SPAWN, "Spawn");
        drawLegendEntry(STRUCTURE_TOWER, "Tower");
        drawLegendEntry(STRUCTURE_STORAGE, "Storage");
        drawLegendEntry('supply', "Supply Flag");
        drawLegendEntry('storageMiner', "Storage Miner");
        
        // Extensions and roads
        drawLegendEntry(STRUCTURE_EXTENSION, "Extension");
        drawLegendEntry(STRUCTURE_ROAD, "Road");
        
        // Advanced structures
        drawLegendEntry(STRUCTURE_TERMINAL, "Terminal");
        drawLegendEntry(STRUCTURE_LAB, "Lab");
        drawLegendEntry(STRUCTURE_LINK, "Link", "C=Center U=Upgrader S=Source");
        drawLegendEntry(STRUCTURE_FACTORY, "Factory");
        drawLegendEntry(STRUCTURE_OBSERVER, "Observer");
        drawLegendEntry(STRUCTURE_NUKER, "Nuker");
        drawLegendEntry(STRUCTURE_POWER_SPAWN, "Power Spawn");
    },

    drawStructureVisual: function(roomVis, pos, structureType, category) {
        const x = pos[0];
        const y = pos[1];
        
        // Add category-based styling if needed
        let strokeColor = '#000000';
        let strokeWidth = 0.1;
        
        switch (category) {
            case 'core':
                strokeColor = '#ff0000';
                strokeWidth = 0.15;
                break;
            case 'priority':
                strokeColor = '#ffaa00';
                strokeWidth = 0.12;
                break;
            case 'extension':
                strokeColor = '#666666';
                strokeWidth = 0.08;
                break;
            case 'road':
                strokeColor = '#333333';
                strokeWidth = 0.05;
                break;
            case 'link':
                strokeColor = '#0088ff';
                strokeWidth = 0.12;
                break;
            case 'lab':
                strokeColor = '#aa00ff';
                strokeWidth = 0.12;
                break;
            case 'rampart':
                strokeColor = '#00ff00';
                strokeWidth = 0.05;
                break;
        }
        
        switch (structureType) {
            case STRUCTURE_SPAWN:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#ffaa00',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('S', x, y + 0.1, {
                    color: '#000000',
                    font: '0.5',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_TOWER:
                roomVis.circle(x, y, {
                    radius: 0.3,
                    fill: '#ff0000',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('T', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.4',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_EXTENSION:
                roomVis.circle(x, y, {
                    radius: 0.2,
                    fill: '#ffff00',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                break;
                
            case STRUCTURE_ROAD:
                roomVis.circle(x, y, {
                    radius: 0.15,
                    fill: '#666666',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                break;
                
            case STRUCTURE_STORAGE:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#00ff00',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('ST', x, y + 0.1, {
                    color: '#000000',
                    font: '0.3',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_LAB:
                roomVis.circle(x, y, {
                    radius: 0.3,
                    fill: '#aa00ff',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('L', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.4',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_TERMINAL:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#00aaff',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('TM', x, y + 0.1, {
                    color: '#000000',
                    font: '0.3',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_FACTORY:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#888888',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('F', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.4',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_OBSERVER:
                roomVis.circle(x, y, {
                    radius: 0.3,
                    fill: '#ffffff',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('O', x, y + 0.1, {
                    color: '#000000',
                    font: '0.4',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_NUKER:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#ff6600',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('N', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.4',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_POWER_SPAWN:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#ff0088',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('P', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.4',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_LINK:
                roomVis.circle(x, y, {
                    radius: 0.3,
                    fill: '#0088ff',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('LK', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.3',
                    align: 'center'
                });
                break;
                
            case STRUCTURE_RAMPART:
                roomVis.circle(x, y, {
                    radius: 0.45,
                    fill: 'transparent',
                    stroke: '#00ff00',
                    strokeWidth: 0.1,
                    opacity: 0.5
                });
                break;
                
            case 'supply':
                roomVis.circle(x, y, {
                    radius: 0.2,
                    fill: '#00ff88',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('SUP', x, y + 0.1, {
                    color: '#000000',
                    font: '0.3',
                    align: 'center'
                });
                break;
                
            case 'storageMiner':
                roomVis.circle(x, y, {
                    radius: 0.2,
                    fill: '#ffaa88',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('SM', x, y + 0.1, {
                    color: '#000000',
                    font: '0.3',
                    align: 'center'
                });
                break;
                
            default:
                // Generic structure visualization
                roomVis.circle(x, y, {
                    radius: 0.25,
                    fill: '#cccccc',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('?', x, y + 0.1, {
                    color: '#000000',
                    font: '0.4',
                    align: 'center'
                });
                break;
        }
    },

    // Helper function to draw legend icons that match the visualization
    drawLegendIcon: function(roomVis, x, y, structureType) {
        // Use the same visualization code as drawStructureVisual but smaller scale
        const scale = 0.8; // Make legend icons slightly smaller
        
        switch (structureType) {
            case STRUCTURE_SPAWN:
                roomVis.circle(x, y, {
                    radius: 0.4 * scale,
                    fill: '#ffaa00',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('S', x, y + 0.1, {
                    color: '#000000',
                    font: (0.5 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_TOWER:
                roomVis.circle(x, y, {
                    radius: 0.3 * scale,
                    fill: '#ff0000',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('T', x, y + 0.1, {
                    color: '#ffffff',
                    font: (0.4 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_EXTENSION:
                roomVis.circle(x, y, {
                    radius: 0.2 * scale,
                    fill: '#ffff00',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                break;
                
            case STRUCTURE_ROAD:
                roomVis.circle(x, y, {
                    radius: 0.15 * scale,
                    fill: '#666666',
                    stroke: '#000000',
                    strokeWidth: 0.05
                });
                break;
                
            case STRUCTURE_STORAGE:
                roomVis.circle(x, y, {
                    radius: 0.4 * scale,
                    fill: '#00ff00',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('ST', x, y + 0.1, {
                    color: '#000000',
                    font: (0.3 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_LAB:
                roomVis.circle(x, y, {
                    radius: 0.3 * scale,
                    fill: '#aa00ff',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('L', x, y + 0.1, {
                    color: '#ffffff',
                    font: (0.4 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_TERMINAL:
                roomVis.circle(x, y, {
                    radius: 0.4 * scale,
                    fill: '#00aaff',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('TM', x, y + 0.1, {
                    color: '#000000',
                    font: (0.3 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_FACTORY:
                roomVis.circle(x, y, {
                    radius: 0.4 * scale,
                    fill: '#888888',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('F', x, y + 0.1, {
                    color: '#ffffff',
                    font: (0.4 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_OBSERVER:
                roomVis.circle(x, y, {
                    radius: 0.3 * scale,
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('O', x, y + 0.1, {
                    color: '#000000',
                    font: (0.4 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_NUKER:
                roomVis.circle(x, y, {
                    radius: 0.4 * scale,
                    fill: '#ff6600',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('N', x, y + 0.1, {
                    color: '#ffffff',
                    font: (0.4 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_POWER_SPAWN:
                roomVis.circle(x, y, {
                    radius: 0.4 * scale,
                    fill: '#ff0088',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('P', x, y + 0.1, {
                    color: '#ffffff',
                    font: (0.4 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case STRUCTURE_LINK:
                roomVis.circle(x, y, {
                    radius: 0.3 * scale,
                    fill: '#0088ff',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('LK', x, y + 0.1, {
                    color: '#ffffff',
                    font: (0.3 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case 'supply':
                roomVis.circle(x, y, {
                    radius: 0.2 * scale,
                    fill: '#00ff88',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('SUP', x, y + 0.1, {
                    color: '#000000',
                    font: (0.3 * scale).toString(),
                    align: 'center'
                });
                break;
                
            case 'storageMiner':
                roomVis.circle(x, y, {
                    radius: 0.2 * scale,
                    fill: '#ffaa88',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('SM', x, y + 0.1, {
                    color: '#000000',
                    font: (0.3 * scale).toString(),
                    align: 'center'
                });
                break;
                
            default:
                // Generic structure visualization
                roomVis.circle(x, y, {
                    radius: 0.25,
                    fill: '#cccccc',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('?', x, y + 0.1, {
                    color: '#000000',
                    font: '0.4',
                    align: 'center'
                });
                break;
        }
    },

    drawTerrainOverview: function(roomVis, terrain, centerCoords) {
        // Draw a subtle background showing the 7x7 planning area
        roomVis.rect(centerCoords[0] - 3.5, centerCoords[1] - 3.5, 7, 7, {
            fill: 'transparent',
            stroke: '#ffff00',
            strokeWidth: 0.1,
            opacity: 0.3
        });
        
        // Mark the center point
        roomVis.circle(centerCoords[0], centerCoords[1], {
            radius: 0.2,
            fill: '#ff0000',
            opacity: 0.8
        });
        
        roomVis.text('CENTER', centerCoords[0], centerCoords[1] - 0.5, {
            color: '#ff0000',
            font: '0.5',
            align: 'center'
        });
    }
};

module.exports = tool_generateBase;
