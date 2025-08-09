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
     * 
     * DYNAMIC CORE STRUCTURE SYSTEM:
     * The core 3x3 structure layout is now dynamically generated based on flag positions:
     * - Supply flag placement adapts to room direction
     * - Storage is placed adjacent to both Supply flag and storageMiner flag
     * - Remaining positions are filled with towers and spawns as needed
     */

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
        
        // Step 3: Process rampart queue to place ramparts on existing structures
        if (!shouldVisualize) {
            this.processRampartQueue(thisRoom);
        }
        
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
        let occupiedPositions = new Set(); // Always track occupied positions to prevent conflicts
        
        if (shouldVisualize) {
            roomVis = new RoomVisual(thisRoom.name);
            roomVis.clear();
            
            // Draw terrain overview for visualization
            this.drawTerrainOverview(roomVis, terrain, bestCenterCoords);
            console.log(`Visualizing base plan for ${thisRoom.name}`);
        }

        // Generate compact 3x3 core structures
        this.generateCoreStructures(thisRoom, terrain, bestCenterCoords, bestDirection, roomVis, occupiedPositions);

        // Generate storageMiner flag and storage adjacent to the core (not conflicting with it)
        this.generateStorageMinerAndStorage(thisRoom, terrain, mainSource, bestCenterCoords, bestDirection, roomVis, occupiedPositions);
        
        // Generate upgradeMiner flag near the secondary source for link placement
        if (notMainSource) {
            this.generateUpgradeMinerFlag(thisRoom, terrain, notMainSource, bestCenterCoords, roomVis, occupiedPositions);
        }

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

    // Dynamic core structure generation - adapts based on flag positions
    generateCoreStructures: function(thisRoom, terrain, bestCenterCoords, bestDirection, roomVis = null, occupiedPositions = null) {
        // Get flag positions if they exist
        let supplyFlagPos = null;
        let storageMinerPos = null;
        
        if (Game.flags[thisRoom.name + "Supply"]) {
            supplyFlagPos = [Game.flags[thisRoom.name + "Supply"].pos.x, Game.flags[thisRoom.name + "Supply"].pos.y];
        }
        if (Game.flags[thisRoom.name + "storageMiner"]) {
            storageMinerPos = [Game.flags[thisRoom.name + "storageMiner"].pos.x, Game.flags[thisRoom.name + "storageMiner"].pos.y];
        }
        
        // Define the 3x3 core boundaries
        const coreMinX = bestCenterCoords[0] - 1;
        const coreMaxX = bestCenterCoords[0] + 1;
        const coreMinY = bestCenterCoords[1] - 1;
        const coreMaxY = bestCenterCoords[1] + 1;
        
        // Generate all positions in the 3x3 core
        const corePositions = [];
        for (let x = coreMinX; x <= coreMaxX; x++) {
            for (let y = coreMinY; y <= coreMaxY; y++) {
                corePositions.push([x, y]);
            }
        }
        
        // Track which positions are reserved for specific purposes
        const reservedPositions = new Set();
        const structurePlacements = new Map();
        
        // Step 1: Place Supply flag at center or appropriate position based on direction
        this.placeSupplyFlag(bestCenterCoords, bestDirection, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions);
        
        // Step 2: Place storage adjacent to both Supply flag and storageMiner (if both exist)
        if (supplyFlagPos && storageMinerPos) {
            this.placeStorageAdjacentToBothFlags(supplyFlagPos, storageMinerPos, corePositions, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions);
        }
        
        // Step 3: Place spawn in remaining suitable position
        this.placeSpawnInCore(corePositions, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions);
        
        // Step 4: Fill remaining positions with towers
        this.fillRemainingWithTowers(corePositions, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions);
        
        // Execute all placements
        this.executePlacements(structurePlacements, thisRoom, roomVis, occupiedPositions);
    },

    placeSupplyFlag: function(bestCenterCoords, bestDirection, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions) {
        // Place Supply flag based on direction preference
        let supplyPos;
        
        switch(bestDirection) {
            case 1: // Bottom-left - place supply on left side
                supplyPos = [bestCenterCoords[0] - 1, bestCenterCoords[1]];
                break;
            case 3: // Bottom-right - place supply in center
                supplyPos = [bestCenterCoords[0], bestCenterCoords[1]];
                break;
            case 7: // Top-left - place supply in center
                supplyPos = [bestCenterCoords[0], bestCenterCoords[1]];
                break;
            case 9: // Top-right - place supply in center
                supplyPos = [bestCenterCoords[0], bestCenterCoords[1]];
                break;
            default:
                supplyPos = [bestCenterCoords[0], bestCenterCoords[1]]; // Default to center
        }
        
        structurePlacements.set(`${supplyPos[0]},${supplyPos[1]}`, 'supply');
        reservedPositions.add(`${supplyPos[0]},${supplyPos[1]}`);
    },

    placeStorageAdjacentToBothFlags: function(supplyFlagPos, storageMinerPos, corePositions, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions) {
        // Helper function to check if a position is adjacent to a target position
        const isAdjacent = (pos1, pos2) => {
            return Math.abs(pos1[0] - pos2[0]) <= 1 && Math.abs(pos1[1] - pos2[1]) <= 1 && 
                   !(pos1[0] === pos2[0] && pos1[1] === pos2[1]); // Not the same position
        };
        
        // Find core positions that are adjacent to both flags
        const validStoragePositions = corePositions.filter(pos => {
            const posKey = `${pos[0]},${pos[1]}`;
            // Skip if position is already reserved
            if (reservedPositions.has(posKey)) return false;
            
            // Check if adjacent to both flags
            const adjacentToSupply = isAdjacent(pos, supplyFlagPos);
            const adjacentToStorageMiner = isAdjacent(pos, storageMinerPos);
            
            return adjacentToSupply && adjacentToStorageMiner;
        });
        
        if (validStoragePositions.length > 0) {
            // Choose the first valid position (could add more sophisticated selection logic)
            const storagePos = validStoragePositions[0];
            structurePlacements.set(`${storagePos[0]},${storagePos[1]}`, STRUCTURE_STORAGE);
            reservedPositions.add(`${storagePos[0]},${storagePos[1]}`);
            console.log(`Planned storage at ${storagePos[0]},${storagePos[1]} adjacent to both Supply flag and storageMiner`);
        } else {
            console.log(`Warning: No core position found adjacent to both Supply flag and storageMiner`);
            // Fallback: place storage adjacent to Supply flag only
            const fallbackPositions = corePositions.filter(pos => {
                const posKey = `${pos[0]},${pos[1]}`;
                if (reservedPositions.has(posKey)) return false;
                return isAdjacent(pos, supplyFlagPos);
            });
            
            if (fallbackPositions.length > 0) {
                const storagePos = fallbackPositions[0];
                structurePlacements.set(`${storagePos[0]},${storagePos[1]}`, STRUCTURE_STORAGE);
                reservedPositions.add(`${storagePos[0]},${storagePos[1]}`);
                console.log(`Fallback: Planned storage at ${storagePos[0]},${storagePos[1]} adjacent to Supply flag only`);
            }
        }
    },

    placeSpawnInCore: function(corePositions, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions) {
        // Find a good position for spawn (avoid center if possible)
        const availablePositions = corePositions.filter(pos => {
            const posKey = `${pos[0]},${pos[1]}`;
            return !reservedPositions.has(posKey);
        });
        
        if (availablePositions.length > 0) {
            // Calculate the center of the core area
            const centerX = Math.floor((Math.min(...corePositions.map(pos => pos[0])) + Math.max(...corePositions.map(pos => pos[0]))) / 2);
            const centerY = Math.floor((Math.min(...corePositions.map(pos => pos[1])) + Math.max(...corePositions.map(pos => pos[1]))) / 2);
            
            // Prefer corner or edge positions for spawn
            const preferredPos = availablePositions.find(pos => {
                // Check if it's a corner or edge position (not center)
                const isCornerOrEdge = pos[0] !== centerX || pos[1] !== centerY;
                return isCornerOrEdge;
            }) || availablePositions[0]; // Fallback to any available position
            
            structurePlacements.set(`${preferredPos[0]},${preferredPos[1]}`, STRUCTURE_SPAWN);
            reservedPositions.add(`${preferredPos[0]},${preferredPos[1]}`);
        }
    },

    fillRemainingWithTowers: function(corePositions, structurePlacements, reservedPositions, thisRoom, roomVis, occupiedPositions) {
        // Fill all remaining core positions with towers
        corePositions.forEach(pos => {
            const posKey = `${pos[0]},${pos[1]}`;
            if (!reservedPositions.has(posKey)) {
                structurePlacements.set(posKey, STRUCTURE_TOWER);
            }
        });
    },

    executePlacements: function(structurePlacements, thisRoom, roomVis, occupiedPositions) {
        // Execute all planned structure placements
        structurePlacements.forEach((structureData, posKey) => {
            const [x, y] = posKey.split(',').map(Number);
            
            if (roomVis) {
                // Visualization mode
                this.drawStructureVisual(roomVis, [x, y], structureData, 'core');
                if (occupiedPositions) {
                    occupiedPositions.add(posKey);
                }
            } else {
                // Generation mode
                this.createStructureFromData(thisRoom, [x, y], structureData);
                if (occupiedPositions) {
                    occupiedPositions.add(posKey);
                }
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
                if (occupiedPositions) {
                    // Check occupied positions set (both visualization and generation mode)
                    const posKey = `${x},${y}`;
                    if (occupiedPositions.has(posKey)) continue;
                }
                
                if (!roomVis) {
                    // In generation mode, also check for real structures/sites/flags
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
            // Track this position as occupied
            if (occupiedPositions) {
                occupiedPositions.add(`${storageMinerPos[0]},${storageMinerPos[1]}`);
            }
        }
        
        // Storage placement is now handled by the core structure layout at position 5,5
        // which is adjacent to both the storageMiner and Supply flag positions
    },

    generateUpgradeMinerFlag: function(thisRoom, terrain, notMainSource, bestCenterCoords, roomVis = null, occupiedPositions = null) {
        if (!notMainSource) return;

        // Find positions adjacent to the secondary source that are closest to the main base
        const sourcePos = [notMainSource.pos.x, notMainSource.pos.y];
        const candidatePositions = [];
        
        if (roomVis) {
            // Draw the secondary source for visualization
            roomVis.circle(sourcePos[0], sourcePos[1], {
                radius: 0.5,
                fill: '#ffff00',
                stroke: '#000000',
                strokeWidth: 0.1
            });
            roomVis.text('SRC2', sourcePos[0], sourcePos[1] + 0.1, {
                color: '#000000',
                font: '0.4',
                align: 'center'
            });
        }
        
        // Check positions around the secondary source
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip source position
                
                const upgradeMinerPos = [sourcePos[0] + x, sourcePos[1] + y];
                
                // Check if position is valid (not wall, within bounds)
                if (upgradeMinerPos[0] <= 2 || upgradeMinerPos[0] >= 47 || upgradeMinerPos[1] <= 2 || upgradeMinerPos[1] >= 47) continue;
                if (terrain.get(upgradeMinerPos[0], upgradeMinerPos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied
                if (occupiedPositions) {
                    // Check occupied positions set (both visualization and generation mode)
                    const posKey = `${upgradeMinerPos[0]},${upgradeMinerPos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                }
                
                if (!roomVis) {
                    // In generation mode, also check for real structures/sites/flags
                    const roomPos = new RoomPosition(upgradeMinerPos[0], upgradeMinerPos[1], thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) continue;
                }
                
                // Check if this position will have road accessibility based on checkerboard pattern
                let hasRoadAccess = false;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue; // Skip the position itself
                        
                        const adjX = upgradeMinerPos[0] + dx;
                        const adjY = upgradeMinerPos[1] + dy;
                        
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
                
                // Calculate distance to main base for prioritization
                const distanceToBase = Math.sqrt(Math.pow(upgradeMinerPos[0] - bestCenterCoords[0], 2) + Math.pow(upgradeMinerPos[1] - bestCenterCoords[1], 2));
                candidatePositions.push({
                    pos: upgradeMinerPos,
                    distance: distanceToBase,
                    hasRoadAccess: hasRoadAccess
                });
            }
        }
        
        if (candidatePositions.length === 0) {
            console.log(`No valid positions found for upgradeMiner around secondary source at ${sourcePos[0]},${sourcePos[1]}`);
            return;
        }
        
        // Sort by road accessibility first, then by distance to main base
        // Prioritize positions with road access, then by proximity to main base
        candidatePositions.sort((a, b) => {
            if (a.hasRoadAccess && !b.hasRoadAccess) return -1;
            if (!a.hasRoadAccess && b.hasRoadAccess) return 1;
            return a.distance - b.distance;
        });
        
        const upgradeMinerPos = candidatePositions[0].pos;
        const hasRoadAccess = candidatePositions[0].hasRoadAccess;
        
        if (roomVis) {
            // Visualization mode
            this.drawStructureVisual(roomVis, upgradeMinerPos, 'upgradeMiner', 'core');
            if (occupiedPositions) {
                occupiedPositions.add(`${upgradeMinerPos[0]},${upgradeMinerPos[1]}`);
            }
            
            // Add visual indicator for road access
            if (hasRoadAccess) {
                roomVis.text('R', upgradeMinerPos[0] + 0.3, upgradeMinerPos[1] - 0.3, {
                    color: '#00ff00',
                    font: '0.3',
                    stroke: '#000000',
                    strokeWidth: 0.05
                });
            }
        } else {
            // Generation mode - Place upgradeMiner flag if it doesn't exist
            if (!Game.flags[thisRoom.name + "upgradeMiner"]) {
                thisRoom.createFlag(upgradeMinerPos[0], upgradeMinerPos[1], thisRoom.name + "upgradeMiner");
                console.log(`Placed upgradeMiner flag at ${upgradeMinerPos[0]},${upgradeMinerPos[1]} adjacent to secondary source (road access: ${hasRoadAccess})`);
            }
            // Track this position as occupied
            if (occupiedPositions) {
                occupiedPositions.add(`${upgradeMinerPos[0]},${upgradeMinerPos[1]}`);
            }
        }
    },

    ensureStorageMinerRoadAccess: function(thisRoom, terrain, storageMinerPos, bestCenterCoords, occupiedPositions = null) {
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
                
                // Track this position as occupied
                if (occupiedPositions) {
                    occupiedPositions.add(`${roadPos[0]},${roadPos[1]}`);
                }
                
                // Schedule rampart placement for later (after main structure is built)
                if (thisRoom.controller.level >= 2) {
                    this.scheduleRampartPlacement(thisRoom, roadPos[0], roadPos[1]);
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
        
        // Count already placed structures from core (dynamic system)
        // Since we use dynamic placement, count existing structures in the 3x3 core area
        const coreMinX = bestCenterCoords[0] - 1;
        const coreMaxX = bestCenterCoords[0] + 1;
        const coreMinY = bestCenterCoords[1] - 1;
        const coreMaxY = bestCenterCoords[1] + 1;
        
        // Find spawn position from core area to avoid blocking it
        let spawnPos = null;
        
        for (let x = coreMinX; x <= coreMaxX; x++) {
            for (let y = coreMinY; y <= coreMaxY; y++) {
                if (!roomVis) {
                    // In generation mode, count existing structures and find spawn
                    const roomPos = new RoomPosition(x, y, thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    
                    [...structures, ...sites].forEach(structure => {
                        const structType = structure.structureType;
                        if (structureCounts[structType] !== undefined) {
                            structureCounts[structType]++;
                        }
                        // Track spawn position
                        if (structType === STRUCTURE_SPAWN) {
                            spawnPos = [x, y];
                        }
                    });
                } else {
                    // In visualization mode, we'll assume typical core layout counts
                    // This is an approximation for visualization purposes
                    // 1 storage, 1 spawn, ~6 towers in a 3x3 core
                    if (x === coreMinX && y === coreMinY) {
                        // Only count once during the first iteration
                        structureCounts[STRUCTURE_STORAGE] = 1;
                        structureCounts[STRUCTURE_SPAWN] = 1;
                        structureCounts[STRUCTURE_TOWER] = 6; // Approximate tower count in core
                        // Assume spawn is at a corner position for visualization
                        spawnPos = [coreMinX, coreMinY];
                    }
                }
            }
        }

        // Helper function to check if position is adjacent to spawn
        const isAdjacentToSpawn = (pos) => {
            if (!spawnPos) return false;
            
            const dx = Math.abs(pos[0] - spawnPos[0]);
            const dy = Math.abs(pos[1] - spawnPos[1]);
            
            // Adjacent includes diagonal positions
            return dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0);
        };

        // Helper function to check if spawn has external access
        const checkSpawnAccess = () => {
            if (!spawnPos) return true; // No spawn found, assume it's fine
            
            // Check if spawn has at least one free adjacent position outside the core
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (dx === 0 && dy === 0) continue;
                    
                    const adjX = spawnPos[0] + dx;
                    const adjY = spawnPos[1] + dy;
                    
                    // Check if this position is outside the core
                    if (adjX < coreMinX || adjX > coreMaxX || adjY < coreMinY || adjY > coreMaxY) {
                        // Check if position is valid and not occupied
                        if (adjX > 2 && adjX < 47 && adjY > 2 && adjY < 47) {
                            if (terrain.get(adjX, adjY) !== TERRAIN_MASK_WALL) {
                                return true; // Found at least one accessible position
                            }
                        }
                    }
                }
            }
            return false; // No external access found
        };

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
                if (occupiedPositions) {
                    // Check occupied positions set (both visualization and generation mode)
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                }
                
                if (!roomVis) {
                    // In generation mode, also check for real structures/sites/flags
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
                        
                        // Special check: avoid placing structures adjacent to spawn in first ring
                        // This ensures spawn has at least one free adjacent position for external access
                        if (radius === 2 && isAdjacentToSpawn(pos)) {
                            // Skip this position if it's adjacent to spawn in the first ring
                            console.log(`Skipping position ${pos[0]},${pos[1]} adjacent to spawn at ${spawnPos[0]},${spawnPos[1]} to preserve access`);
                            break; // Break out of structure loop, continue to next position
                        }
                        
                        if (roomVis) {
                            // Visualization mode - add special handling for links
                            let linkCategory = 'priority';
                            if (priorityStruct.type === STRUCTURE_LINK) {
                                linkCategory = 'link';
                            }
                            this.drawStructureVisual(roomVis, pos, priorityStruct.type, linkCategory);
                            if (occupiedPositions) {
                                occupiedPositions.add(`${pos[0]},${pos[1]}`);
                            }
                        } else {
                            // Generation mode
                            thisRoom.createConstructionSite(pos[0], pos[1], priorityStruct.type);
                            console.log(`Placed ${priorityStruct.type} at radius ${radius} position ${pos[0]},${pos[1]}`);
                            
                            // Track this position as occupied
                            if (occupiedPositions) {
                                occupiedPositions.add(`${pos[0]},${pos[1]}`);
                            }
                            
                            // Schedule rampart placement for later (after main structure is built)
                            if (thisRoom.controller.level >= 2) {
                                this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
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
                if (occupiedPositions) {
                    // Check occupied positions set (both visualization and generation mode)
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                }
                
                if (!roomVis) {
                    // In generation mode, also check for real structures/sites/flags
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
                        
                        // Track this position as occupied
                        if (occupiedPositions) {
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                        }
                        
                        // Schedule rampart placement for later (after main structure is built)
                        if (thisRoom.controller.level >= 2) {
                            this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
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
                        
                        // Track this position as occupied
                        if (occupiedPositions) {
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                        }
                        
                        // Schedule rampart placement for later (after main structure is built)
                        if (thisRoom.controller.level >= 2) {
                            this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
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
                    if (occupiedPositions) {
                        // Check occupied positions set (both visualization and generation mode)
                        const posKey = `${worldX},${worldY}`;
                        if (occupiedPositions.has(posKey)) {
                            canPlaceCluster = false;
                            break;
                        }
                    }
                    
                    if (!roomVis) {
                        // In generation mode, also check for real structures/sites/flags
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
                            
                            // Track this position as occupied
                            if (occupiedPositions) {
                                occupiedPositions.add(`${labPos.x},${labPos.y}`);
                            }
                            
                            // Schedule rampart placement for later (after main structure is built)
                            if (thisRoom.controller.level >= 2) {
                                this.scheduleRampartPlacement(thisRoom, labPos.x, labPos.y);
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
                        // This position would be a road if (adjX + adjY) % 2 !== 0
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
            } else if (structureData === 'upgradeMiner' && !Game.flags[thisRoom.name + "upgradeMiner"]) {
                thisRoom.createFlag(pos[0], pos[1], thisRoom.name + "upgradeMiner");
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
            } else if (structureData === STRUCTURE_STORAGE) {
                // Storage requires controller level 4
                if (thisRoom.controller.level >= 4) {
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_STORAGE);
                }
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
        
        console.log(`Generating optimal link system for ${thisRoom.name}`);
        
        // Count existing links
        let existingLinks = 0;
        let plannedLinks = 0;
        
        if (!roomVis) {
            // Only count in generation mode
            existingLinks = thisRoom.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_LINK
            }).length;
            plannedLinks = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
                filter: s => s.structureType === STRUCTURE_LINK
            }).length;
        }
        
        let linksPlaced = existingLinks + plannedLinks;
        const maxLinks = CONTROLLER_STRUCTURES[STRUCTURE_LINK][thisRoom.controller.level] || 0;
        
        console.log(`Starting with ${existingLinks} existing links and ${plannedLinks} planned links = ${linksPlaced} total`);
        console.log(`Room level ${thisRoom.controller.level} allows ${maxLinks} total links`);
        
        if (!roomVis && linksPlaced >= maxLinks) {
            console.log(`Already have ${linksPlaced} links (max ${maxLinks}), skipping link generation`);
            return;
        }
        
        // Priority 1: Source link (most important for energy flow)
        if (linksPlaced < maxLinks && notMainSource) {
            console.log(`Priority 1: Attempting to place source link...`);
            const sourceLinksPlaced = this.placeSourceLinks(thisRoom, terrain, notMainSource, 1, roomVis, occupiedPositions);
            linksPlaced += sourceLinksPlaced;
            console.log(`Placed ${sourceLinksPlaced} source links, total links: ${linksPlaced}`);
        } else if (!notMainSource) {
            console.log(`No secondary source found, skipping source link`);
        }
        
        // Priority 2: Controller link (for upgraders)
        if (linksPlaced < maxLinks) {
            console.log(`Priority 2: Attempting to place controller link...`);
            if (this.placeControllerLink(thisRoom, terrain, roomVis, occupiedPositions)) {
                linksPlaced++;
                console.log(`Controller link placed, total links: ${linksPlaced}`);
            } else {
                console.log(`Failed to place controller link`);
            }
        }
        
        // Priority 3: Additional source link (if room level allows and we have space)
        if (linksPlaced < maxLinks && notMainSource && thisRoom.controller.level >= 6) {
            console.log(`Priority 3: Attempting to place second source link...`);
            const additionalSourceLinks = this.placeSourceLinks(thisRoom, terrain, notMainSource, 1, roomVis, occupiedPositions);
            linksPlaced += additionalSourceLinks;
            console.log(`Placed ${additionalSourceLinks} additional source links, total links: ${linksPlaced}`);
        }
        
        // Priority 4: Center link (lowest priority - only if we have remaining capacity)
        if (linksPlaced < maxLinks && thisRoom.controller.level >= 6) {
            console.log(`Priority 4: Attempting to place center link...`);
            if (this.placeCenterLink(thisRoom, terrain, bestCenterCoords, roomVis, occupiedPositions)) {
                linksPlaced++;
                console.log(`Center link placed, total links: ${linksPlaced}`);
            } else {
                console.log(`Failed to place center link (not critical)`);
            }
        }
        
        console.log(`Link generation complete for ${thisRoom.name}: placed ${linksPlaced} of ${maxLinks} available links`);
        
        // Log the final link configuration
        if (roomVis || linksPlaced > 0) {
            let linkTypes = [];
            if (notMainSource && linksPlaced >= 1) linkTypes.push("source");
            if (linksPlaced >= 2) linkTypes.push("controller");
            if (linksPlaced >= 3 && thisRoom.controller.level >= 6) linkTypes.push("second source");
            if (linksPlaced >= 4 && thisRoom.controller.level >= 6) linkTypes.push("center");
            
            console.log(`Link configuration: ${linkTypes.join(", ")}`);
        }
    },

    placeCenterLink: function(thisRoom, terrain, bestCenterCoords, roomVis = null, occupiedPositions = null) {
        // Place a link near the center core area for central distribution
        // Look for positions around the 3x3 core, not inside it
        const coreMinX = bestCenterCoords[0] - 1;
        const coreMaxX = bestCenterCoords[0] + 1;
        const coreMinY = bestCenterCoords[1] - 1;
        const coreMaxY = bestCenterCoords[1] + 1;
        
        const centerPositions = [];
        
        // Check positions around the 3x3 core perimeter
        for (let y = coreMinY - 1; y <= coreMaxY + 1; y++) {
            for (let x = coreMinX - 1; x <= coreMaxX + 1; x++) {
                // Skip positions inside the 3x3 core
                if (x >= coreMinX && x <= coreMaxX && y >= coreMinY && y <= coreMaxY) continue;
                
                // Check if position is valid (not wall, within bounds)
                if (x <= 2 || x >= 47 || y <= 2 || y >= 47) continue;
                if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
                
                // Calculate distance to core center for prioritization
                const distanceToCore = Math.sqrt(Math.pow(x - bestCenterCoords[0], 2) + Math.pow(y - bestCenterCoords[1], 2));
                centerPositions.push({
                    pos: [x, y],
                    distance: distanceToCore
                });
            }
        }
        
        // Sort by distance to core center - closest first
        centerPositions.sort((a, b) => a.distance - b.distance);
        
        for (const posData of centerPositions) {
            const pos = posData.pos;
            
            // Check if position is not occupied
            if (occupiedPositions) {
                // Check occupied positions set (both visualization and generation mode)
                const posKey = `${pos[0]},${pos[1]}`;
                if (occupiedPositions.has(posKey)) continue;
            }
            
            if (!roomVis) {
                // In generation mode, also check for real structures/sites/flags
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
                console.log(`Visualized center link at ${pos[0]},${pos[1]} adjacent to core`);
            } else {
                // Generation mode - Place center link here
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                console.log(`Placed center link at ${pos[0]},${pos[1]} adjacent to core`);
                
                // Track this position as occupied
                if (occupiedPositions) {
                    occupiedPositions.add(`${pos[0]},${pos[1]}`);
                }
                
                // Schedule rampart placement for later (after main structure is built)
                if (thisRoom.controller.level >= 2) {
                    this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
                }
            }
            return true; // Successfully placed
        }
        
        console.log(`No valid position found for center link around core at ${bestCenterCoords[0]},${bestCenterCoords[1]}`);
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
                    if (occupiedPositions) {
                        // Check occupied positions set (both visualization and generation mode)
                        const posKey = `${pos[0]},${pos[1]}`;
                        if (occupiedPositions.has(posKey)) continue;
                    }
                    
                    if (!roomVis) {
                        // In generation mode, also check for real structures/sites/flags
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
                        
                        // Track this position as occupied
                        if (occupiedPositions) {
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                        }
                        
                        // Schedule rampart placement for later (after main structure is built)
                        if (thisRoom.controller.level >= 2) {
                            this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
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
        // Check if upgradeMiner flag exists
        const upgradeMinerFlag = Game.flags[thisRoom.name + "upgradeMiner"];
        if (!upgradeMinerFlag) {
            console.log(`No upgradeMiner flag found for ${thisRoom.name} - cannot place source links`);
            return 0;
        }
        
        const upgradeMinerPos = [upgradeMinerFlag.pos.x, upgradeMinerFlag.pos.y];
        let linksPlaced = 0;
        
        console.log(`Searching for ${linksNeeded} source link positions around upgradeMiner flag at ${upgradeMinerPos[0]},${upgradeMinerPos[1]}`);
        
        // Find all valid positions around the upgradeMiner flag for link placement
        const linkPositions = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip upgradeMiner position
                
                const pos = [upgradeMinerPos[0] + x, upgradeMinerPos[1] + y];
                
                // Check if position is valid
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) {
                    console.log(`Position ${pos[0]},${pos[1]} out of bounds`);
                    continue;
                }
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) {
                    console.log(`Position ${pos[0]},${pos[1]} is a wall`);
                    continue;
                }
                
                // Check if position is not occupied
                let isOccupied = false;
                if (occupiedPositions) {
                    // Check occupied positions set (both visualization and generation mode)
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) {
                        console.log(`Position ${pos[0]},${pos[1]} is occupied in occupiedPositions set`);
                        isOccupied = true;
                    }
                }
                
                if (!roomVis && !isOccupied) {
                    // In generation mode, also check for real structures/sites/flags
                    const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    const flags = roomPos.lookFor(LOOK_FLAGS);
                    if (structures.length > 0 || sites.length > 0 || flags.length > 0) {
                        console.log(`Position ${pos[0]},${pos[1]} has existing structures/sites/flags`);
                        isOccupied = true;
                    }
                }
                
                if (!isOccupied) {
                    linkPositions.push(pos);
                    console.log(`Found valid link position: ${pos[0]},${pos[1]}`);
                }
            }
        }
        
        console.log(`Found ${linkPositions.length} valid positions for source links`);
        
        if (linkPositions.length === 0) {
            console.log(`No valid positions found around upgradeMiner flag at ${upgradeMinerPos[0]},${upgradeMinerPos[1]} for source links`);
            return 0;
        }
        
        // Place the requested number of links around the upgradeMiner flag
        const maxLinksToPlace = Math.min(linksNeeded, linkPositions.length);
        console.log(`Attempting to place ${maxLinksToPlace} source links`);
        
        for (let i = 0; i < maxLinksToPlace && linksPlaced < linksNeeded; i++) {
            const pos = linkPositions[i];
            
            if (roomVis) {
                // Visualization mode
                this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
                if (occupiedPositions) {
                    occupiedPositions.add(`${pos[0]},${pos[1]}`);
                }
                console.log(`Visualized source link ${linksPlaced + 1} at ${pos[0]},${pos[1]} near upgradeMiner flag`);
            } else {
                // Generation mode
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                console.log(`Placed source link ${linksPlaced + 1} at ${pos[0]},${pos[1]} near upgradeMiner flag`);
                
                // Track this position as occupied
                if (occupiedPositions) {
                    occupiedPositions.add(`${pos[0]},${pos[1]}`);
                }
                
                // Schedule rampart placement for later (after main structure is built)
                if (thisRoom.controller.level >= 2) {
                    this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
                }
            }
            
            linksPlaced++;
        }
        
        if (linksPlaced < linksNeeded) {
            console.log(`Warning: Placed only ${linksPlaced} of ${linksNeeded} requested source links around upgradeMiner flag`);
        } else {
            console.log(`Successfully placed all ${linksPlaced} source links around upgradeMiner flag`);
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
                            
                            // Schedule rampart placement for later (after main structure is built)
                            if (thisRoom.controller.level >= 2) {
                                this.scheduleRampartPlacement(thisRoom, pos[0], pos[1]);
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

    scheduleRampartPlacement: function(thisRoom, x, y) {
        // Initialize rampart queue in memory if it doesn't exist
        if (!Memory.rampartQueue) {
            Memory.rampartQueue = {};
        }
        if (!Memory.rampartQueue[thisRoom.name]) {
            Memory.rampartQueue[thisRoom.name] = [];
        }
        
        // Add position to rampart queue if not already there
        const posKey = `${x},${y}`;
        if (!Memory.rampartQueue[thisRoom.name].includes(posKey)) {
            Memory.rampartQueue[thisRoom.name].push(posKey);
        }
    },

    processRampartQueue: function(thisRoom) {
        // Process queued rampart placements for existing structures
        if (!Memory.rampartQueue || !Memory.rampartQueue[thisRoom.name]) {
            return;
        }
        
        const queue = Memory.rampartQueue[thisRoom.name];
        const processed = [];
        
        for (const posKey of queue) {
            const [x, y] = posKey.split(',').map(Number);
            const roomPos = new RoomPosition(x, y, thisRoom.name);
            
            // Check if there's a structure at this position (built, not just construction site)
            const structures = roomPos.lookFor(LOOK_STRUCTURES);
            const hasMainStructure = structures.some(s => s.structureType !== STRUCTURE_RAMPART);
            
            // Check if there's already a rampart here
            const hasRampart = structures.some(s => s.structureType === STRUCTURE_RAMPART);
            const rampartSite = roomPos.lookFor(LOOK_CONSTRUCTION_SITES).find(s => s.structureType === STRUCTURE_RAMPART);
            
            if (hasMainStructure && !hasRampart && !rampartSite) {
                // Main structure exists, no rampart yet - place rampart
                const result = thisRoom.createConstructionSite(x, y, STRUCTURE_RAMPART);
                if (result === OK) {
                    console.log(`Placed rampart on existing structure at ${x},${y} in ${thisRoom.name}`);
                    processed.push(posKey);
                } else if (result === ERR_FULL) {
                    // Construction site limit reached, try again later
                    break;
                }
            } else if (hasMainStructure && (hasRampart || rampartSite)) {
                // Rampart already exists or is being built - remove from queue
                processed.push(posKey);
            }
            // If no main structure yet, leave in queue for later processing
        }
        
        // Remove processed positions from queue
        Memory.rampartQueue[thisRoom.name] = queue.filter(pos => !processed.includes(pos));
        
        // Clean up empty queue
        if (Memory.rampartQueue[thisRoom.name].length === 0) {
            delete Memory.rampartQueue[thisRoom.name];
        }
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
        drawLegendEntry('upgradeMiner', "Upgrade Miner");
        
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
                
            case 'upgradeMiner':
                roomVis.circle(x, y, {
                    radius: 0.2,
                    fill: '#aaffaa',
                    stroke: strokeColor,
                    strokeWidth: strokeWidth
                });
                roomVis.text('UM', x, y + 0.1, {
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
                
            case 'upgradeMiner':
                roomVis.circle(x, y, {
                    radius: 0.2 * scale,
                    fill: '#aaffaa',
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('UM', x, y + 0.1, {
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
