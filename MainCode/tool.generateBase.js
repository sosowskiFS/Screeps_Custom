var tool_generateBase = {
    // Constants for direction mappings and structure layouts
    DIRECTIONS: {
        1: { x: -1, y: 1 },   // Bottom-left
        3: { x: 1, y: 1 },    // Bottom-right  
        7: { x: -1, y: -1 },  // Top-left
        9: { x: 1, y: -1 }    // Top-right
    },

    /* 
     * DEBUG VISUALIZATION USAGE:
     * To visualize base plans without placing construction sites:
     * 1. Place a flag named "VisualizeBase" in any room
     * 2. Optional: Add "_N" to the flag name to specify controller level (e.g., "VisualizeBase_6" for level 6)
     * 3. The visualization will show structure placement using colored circles and symbols
     * 4. Remove the flag when done viewing to stop the visualization
     */

    // Compact 3x3 core structure layouts for each direction
    STRUCTURE_LAYOUTS: {
        1: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid
            '3,3': STRUCTURE_TOWER,
            '3,4': 'supply', // Supply flag position
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_SPAWN,
            '4,4': STRUCTURE_TOWER, // Tower in center
            '4,5': STRUCTURE_TOWER,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_TOWER,
            '5,5': STRUCTURE_TOWER
        },
        3: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid
            '3,3': STRUCTURE_TOWER,
            '3,4': STRUCTURE_TOWER,
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_TOWER, 
            '4,4': 'supply', // Supply flag position in center
            '4,5': STRUCTURE_SPAWN,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_TOWER,
            '5,5': STRUCTURE_TOWER
        },
        7: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid
            '3,3': STRUCTURE_TOWER,
            '3,4': STRUCTURE_TOWER,
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_TOWER,
            '4,4': 'supply', // Supply flag position in center
            '4,5': STRUCTURE_TOWER,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_SPAWN,
            '5,5': STRUCTURE_TOWER
        },
        9: {
            // Core 3x3 layout (positions 3,3 to 5,5) - center of 7x7 grid
            '3,3': STRUCTURE_TOWER,
            '3,4': STRUCTURE_TOWER,
            '3,5': STRUCTURE_TOWER,
            '4,3': STRUCTURE_SPAWN,
            '4,4': 'supply', // Supply flag position in center
            '4,5': STRUCTURE_TOWER,
            '5,3': STRUCTURE_TOWER,
            '5,4': STRUCTURE_TOWER,
            '5,5': STRUCTURE_TOWER
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

        // Step 1: Find best base location (cached in memory)
        if (!Memory.genBestCenterCoords[thisRoom.name]) {
            const result = this.findBestBaseLocation(thisRoom, terrain, roomSources);
            if (result) {
                Memory.genBestDirection[thisRoom.name] = result.direction;
                Memory.genBestCenterCoords[thisRoom.name] = result.centerCoords;
                Memory.genBestSourceID[thisRoom.name] = result.sourceID;
                
                // Add room to autoBuildRooms list if it's not already there
                if (Memory.autoBuildRooms.indexOf(thisRoom.name) === -1) {
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
        
        // Ensure room is in autoBuildRooms list if structures were generated successfully
        if (Memory.autoBuildRooms.indexOf(thisRoom.name) === -1) {
            Memory.autoBuildRooms.push(thisRoom.name);
            console.log(`Added ${thisRoom.name} to autoBuildRooms - base structures generated.`);
        }
    },

    // Debug visualization function - can run without room access
    visualizeBasePlan: function(roomName, roomLevel = 8) {
        const terrain = new Room.Terrain(roomName);
        
        // Initialize memory objects if they don't exist
        if (!Memory.genBestCenterCoords) Memory.genBestCenterCoords = {};
        if (!Memory.genBestDirection) Memory.genBestDirection = {};
        if (!Memory.genBestSourceID) Memory.genBestSourceID = {};

        let bestCenterCoords, bestDirection, bestSourceID;

        // Check if we have cached data for this room
        if (Memory.genBestCenterCoords[roomName]) {
            bestCenterCoords = Memory.genBestCenterCoords[roomName];
            bestDirection = Memory.genBestDirection[roomName];
            bestSourceID = Memory.genBestSourceID[roomName];
        } else {
            // Try to find sources from memory or room data
            const room = Game.rooms[roomName];
            if (!room) {
                console.log(`Cannot visualize ${roomName} - no room access and no cached data`);
                return;
            }
            
            const roomSources = room.find(FIND_SOURCES);
            if (!roomSources.length) {
                console.log(`Cannot visualize ${roomName} - no sources found`);
                return;
            }

            const result = this.findBestBaseLocation(room, terrain, roomSources);
            if (!result) {
                console.log(`Cannot visualize ${roomName} - no suitable base location found`);
                return;
            }

            bestCenterCoords = result.centerCoords;
            bestDirection = result.direction;
            bestSourceID = result.sourceID;
        }

        // Try to get real room data if available, otherwise use mock data
        let mockRoom, mockSources, notMainSource;
        const realRoom = Game.rooms[roomName];
        
        if (realRoom) {
            // Use real room data but ensure proper controller level for visualization
            mockRoom = {
                name: realRoom.name,
                controller: { 
                    level: roomLevel, // Use the specified level for visualization, not the actual room level
                    pos: realRoom.controller ? realRoom.controller.pos : {
                        x: Math.min(47, Math.max(2, bestCenterCoords[0] + 5)),
                        y: Math.min(47, Math.max(2, bestCenterCoords[1] + 5))
                    }
                },
                find: realRoom.find.bind(realRoom)
            };
            const sources = realRoom.find(FIND_SOURCES);
            mockSources = sources;
            notMainSource = sources.find(source => source.id !== bestSourceID);
        } else {
            // Create a mock room object for visualization with estimated controller position
            // Place controller at a reasonable distance from the base center
            const controllerX = Math.min(47, Math.max(2, bestCenterCoords[0] + 5));
            const controllerY = Math.min(47, Math.max(2, bestCenterCoords[1] + 5));
            
            mockRoom = {
                name: roomName,
                controller: { 
                    level: roomLevel,
                    pos: {
                        x: controllerX,
                        y: controllerY
                    }
                },
                find: (type) => {
                    if (type === FIND_MY_STRUCTURES) return [];
                    if (type === FIND_MY_CONSTRUCTION_SITES) return [];
                    return [];
                }
            };

            // Mock sources array - create mock source positions
            const mainSourceX = Math.min(47, Math.max(2, bestCenterCoords[0] - 3));
            const mainSourceY = Math.min(47, Math.max(2, bestCenterCoords[1] - 3));
            const secondarySourceX = Math.min(47, Math.max(2, bestCenterCoords[0] + 8));
            const secondarySourceY = Math.min(47, Math.max(2, bestCenterCoords[1] + 3));
            
            mockSources = [
                { 
                    id: bestSourceID || 'mock-main',
                    pos: { x: mainSourceX, y: mainSourceY }
                },
                { 
                    id: 'mock-secondary',
                    pos: { x: secondarySourceX, y: secondarySourceY }
                }
            ];
            notMainSource = mockSources.find(source => source.id !== bestSourceID);
        }

        console.log(`Visualizing base plan for ${roomName} at controller level ${roomLevel}`);
        
        // Generate visualization
        this.visualizeBaseStructures(mockRoom, terrain, mockSources, bestCenterCoords, bestDirection, bestSourceID, notMainSource);
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

        // Generate compact 3x3 core structures
        this.generateCoreStructures(thisRoom, terrain, bestCenterCoords, bestDirection);

        // Generate storageMiner flag and storage next to the main source
        this.generateStorageMinerAndStorage(thisRoom, terrain, mainSource);

        // Generate priority structures around the core
        this.generatePriorityStructures(thisRoom, terrain, bestCenterCoords, bestDirection, notMainSource);

        // Generate extension grid around core and priority structures
        this.generateExtensionGrid(thisRoom, terrain, bestCenterCoords, notMainSource);

        // Generate lab clusters for reactions (after extensions to place them at the edges)
        this.generateLabClusters(thisRoom, terrain, bestCenterCoords);

        // Generate links
        this.generateLinks(thisRoom, terrain, notMainSource, bestCenterCoords, mainSource);
    },

    generateCoreStructures: function(thisRoom, terrain, bestCenterCoords, bestDirection) {
        const layout = this.STRUCTURE_LAYOUTS[bestDirection];
        
        // Generate the 3x3 core using the layout coordinates directly
        Object.keys(layout).forEach(structureKey => {
            const structureData = layout[structureKey];
            const [layoutX, layoutY] = structureKey.split(',').map(Number);
            
            // Transform layout coordinates (3,3 to 5,5) to world coordinates
            // Layout coordinates are relative to center, so we offset by the center position
            const worldX = bestCenterCoords[0] - 4 + layoutX; // -4 because layout uses 3,4,5 (center at 4)
            const worldY = bestCenterCoords[1] - 4 + layoutY;
            
            console.log(`Placing ${structureData} from layout ${structureKey} at world coords (${worldX},${worldY})`);
            this.createStructureFromData(thisRoom, [worldX, worldY], structureData);
        });
    },

    generateStorageMinerAndStorage: function(thisRoom, terrain, mainSource) {
        if (!mainSource) return;

        const sourcePos = [mainSource.pos.x, mainSource.pos.y];
        
        // Find the best position next to the source for storageMiner flag
        const positions = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip source position
                
                const pos = [sourcePos[0] + x, sourcePos[1] + y];
                
                // Check if position is valid (not wall, within bounds)
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied
                const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                const structures = roomPos.lookFor(LOOK_STRUCTURES);
                const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                if (structures.length > 0 || sites.length > 0) continue;
                
                positions.push(pos);
            }
        }
        
        if (positions.length === 0) {
            console.log(`No valid positions found for storageMiner next to source at ${sourcePos[0]},${sourcePos[1]}`);
            return;
        }
        
        // Choose the first available position for storageMiner
        const storageMinerPos = positions[0];
        
        // Place storageMiner flag if it doesn't exist
        if (!Game.flags[thisRoom.name + "storageMiner"]) {
            thisRoom.createFlag(storageMinerPos[0], storageMinerPos[1], thisRoom.name + "storageMiner");
            console.log(`Placed storageMiner flag at ${storageMinerPos[0]},${storageMinerPos[1]} next to source`);
        }
        
        // Find a position for storage next to the storageMiner
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip storageMiner position
                
                const storagePos = [storageMinerPos[0] + x, storageMinerPos[1] + y];
                
                // Check if position is valid
                if (storagePos[0] <= 2 || storagePos[0] >= 47 || storagePos[1] <= 2 || storagePos[1] >= 47) continue;
                if (terrain.get(storagePos[0], storagePos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied and not the source
                if (storagePos[0] === sourcePos[0] && storagePos[1] === sourcePos[1]) continue;
                
                const roomPos = new RoomPosition(storagePos[0], storagePos[1], thisRoom.name);
                const structures = roomPos.lookFor(LOOK_STRUCTURES);
                const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                if (structures.length > 0 || sites.length > 0) continue;
                
                // Place storage here
                thisRoom.createConstructionSite(storagePos[0], storagePos[1], STRUCTURE_STORAGE);
                console.log(`Placed storage at ${storagePos[0]},${storagePos[1]} next to storageMiner`);
                return; // Only place one storage
            }
        }
        
        console.log(`No valid position found for storage next to storageMiner at ${storageMinerPos[0]},${storageMinerPos[1]}`);
    },

    generatePriorityStructures: function(thisRoom, terrain, bestCenterCoords, bestDirection, notMainSource) {
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
                const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                const structures = roomPos.lookFor(LOOK_STRUCTURES);
                const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                if (structures.length > 0 || sites.length > 0) continue;
                
                // Try to place next priority structure
                for (const priorityStruct of this.PRIORITY_STRUCTURES) {
                    if (thisRoom.controller.level >= priorityStruct.level && 
                        structureCounts[priorityStruct.type] < priorityStruct.count) {
                        
                        thisRoom.createConstructionSite(pos[0], pos[1], priorityStruct.type);
                        structureCounts[priorityStruct.type]++;
                        
                        // Add rampart for defensive structures
                        if (thisRoom.controller.level >= 7) {
                            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                        }
                        break;
                    }
                }
            }
            radius++;
        }
    },

    generateExtensionGrid: function(thisRoom, terrain, bestCenterCoords, notMainSource) {
        const targetExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][thisRoom.controller.level];
        let extensionsPlaced = 0;
        
        // Count existing extensions
        const existingExtensions = thisRoom.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        const plannedExtensions = thisRoom.find(FIND_MY_CONSTRUCTION_SITES, {
            filter: s => s.structureType === STRUCTURE_EXTENSION
        }).length;
        
        extensionsPlaced = existingExtensions + plannedExtensions;

        // Place extensions in checkerboard pattern around the base
        let radius = 2;
        let flipFlop = false;
        
        while (extensionsPlaced < targetExtensions && radius <= 15) {
            const positions = this.getRingPositions(bestCenterCoords, radius);
            
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
                const structures = roomPos.lookFor(LOOK_STRUCTURES);
                const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                if (structures.length > 0 || sites.length > 0) continue;
                
                if (flipFlop) {
                    // Extension position
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_EXTENSION);
                    extensionsPlaced++;
                    
                    if (thisRoom.controller.level >= 7) {
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                    }
                } else {
                    // Road position
                    if (thisRoom.controller.level >= 5) {
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_ROAD);
                    }
                    if (thisRoom.controller.level >= 7) {
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                    }
                }
                
                flipFlop = !flipFlop;
            }
            radius++;
        }
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
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
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

    generateLinks: function(thisRoom, terrain, notMainSource, bestCenterCoords, mainSource) {
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
            this.placeCenterLink(thisRoom, terrain, bestCenterCoords);
            linksPlaced++;
        }
        
        // 2. Place controller link for upgraders (priority 2)
        if (linksPlaced < 4) {
            this.placeControllerLink(thisRoom, terrain);
            linksPlaced++;
        }
        
        // 3 & 4. Place source links near the secondary source (priority 3 & 4)
        if (linksPlaced < 4 && notMainSource) {
            const sourceLinksNeeded = Math.min(2, 4 - linksPlaced);
            this.placeSourceLinks(thisRoom, terrain, notMainSource, sourceLinksNeeded);
        }
        
        console.log(`Link generation complete for ${thisRoom.name}`);
    },

    placeCenterLink: function(thisRoom, terrain, bestCenterCoords) {
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
            const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
            const structures = roomPos.lookFor(LOOK_STRUCTURES);
            const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
            if (structures.length > 0 || sites.length > 0) continue;
            
            // Place center link here
            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
            console.log(`Placed center link at ${pos[0]},${pos[1]}`);
            
            // Add rampart for protection
            if (thisRoom.controller.level >= 7) {
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
            }
            return;
        }
        
        console.log(`No valid position found for center link near ${bestCenterCoords[0]},${bestCenterCoords[1]}`);
    },

    placeControllerLink: function(thisRoom, terrain) {
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
                    const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                    const structures = roomPos.lookFor(LOOK_STRUCTURES);
                    const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                    if (structures.length > 0 || sites.length > 0) continue;
                    
                    // Place controller link here
                    thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
                    console.log(`Placed controller link at ${pos[0]},${pos[1]} near controller`);
                    
                    // Add rampart for protection
                    if (thisRoom.controller.level >= 7) {
                        thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
                    }
                    return;
                }
            }
        }
        
        console.log(`No valid position found for controller link near controller`);
    },

    placeSourceLinks: function(thisRoom, terrain, notMainSource, linksNeeded) {
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
                const roomPos = new RoomPosition(pos[0], pos[1], thisRoom.name);
                const structures = roomPos.lookFor(LOOK_STRUCTURES);
                const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                if (structures.length > 0 || sites.length > 0) continue;
                
                linkPositions.push(pos);
            }
        }
        
        // Place links, but leave at least one free space for miners
        const maxLinksToPlace = Math.min(linksNeeded, linkPositions.length - 1);
        
        for (let i = 0; i < maxLinksToPlace && linksPlaced < linksNeeded; i++) {
            const pos = linkPositions[i];
            thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_LINK);
            console.log(`Placed source link ${linksPlaced + 1} at ${pos[0]},${pos[1]} near secondary source`);
            
            // Add rampart for protection
            if (thisRoom.controller.level >= 7) {
                thisRoom.createConstructionSite(pos[0], pos[1], STRUCTURE_RAMPART);
            }
            
            linksPlaced++;
        }
        
        if (linksPlaced < linksNeeded) {
            console.log(`Only placed ${linksPlaced} of ${linksNeeded} source links - not enough free positions`);
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
    },

    visualizeBaseStructures: function(thisRoom, terrain, roomSources, bestCenterCoords, bestDirection, bestSourceID, notMainSource) {
        const roomVis = new RoomVisual(thisRoom.name);
        
        // Clear any existing visuals
        roomVis.clear();
        
        // Create a map to track occupied positions
        const occupiedPositions = new Set();
        
        // Draw terrain overview
        this.drawTerrainOverview(roomVis, terrain, bestCenterCoords);
        
        // Find the main source for visualization
        let mainSource = null;
        if (roomSources && roomSources.length > 0) {
            // Try to find the main source by ID first
            mainSource = roomSources.find(source => source.id === bestSourceID);
            // If not found by ID, use the first source as fallback
            if (!mainSource) {
                mainSource = roomSources[0];
            }
        }
        
        // Visualize storageMiner and storage near source
        if (mainSource) {
            this.visualizeStorageMinerAndStorage(roomVis, terrain, mainSource, occupiedPositions);
        }
        
        // Visualize compact 3x3 core structures and mark them as occupied
        this.visualizeCoreStructures(roomVis, bestCenterCoords, bestDirection, occupiedPositions);

        // Visualize priority structures around the core
        this.visualizePriorityStructures(roomVis, terrain, bestCenterCoords, bestDirection, notMainSource, thisRoom.controller.level, occupiedPositions);

        // Visualize extension grid around core and priority structures
        this.visualizeExtensionGrid(roomVis, terrain, bestCenterCoords, notMainSource, thisRoom.controller.level, occupiedPositions);

        // Visualize lab clusters
        this.visualizeLabClusters(roomVis, terrain, bestCenterCoords, thisRoom.controller.level, occupiedPositions);

        // Visualize link system
        this.visualizeLinks(roomVis, terrain, bestCenterCoords, notMainSource, thisRoom.controller, occupiedPositions);

        // Add legend
        this.drawLegend(roomVis);
        
        console.log(`Base plan visualization complete for ${thisRoom.name}`);
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
    },

    visualizeStorageMinerAndStorage: function(roomVis, terrain, mainSource, occupiedPositions) {
        if (!mainSource) return;

        const sourcePos = [mainSource.pos.x, mainSource.pos.y];
        
        // Draw the source
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
        
        // Find the best position next to the source for storageMiner flag
        const positions = [];
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip source position
                
                const pos = [sourcePos[0] + x, sourcePos[1] + y];
                
                // Check if position is valid (not wall, within bounds)
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not already occupied
                const posKey = `${pos[0]},${pos[1]}`;
                if (occupiedPositions.has(posKey)) continue;
                
                positions.push(pos);
            }
        }
        
        if (positions.length === 0) {
            console.log(`No valid positions found for storageMiner next to source at ${sourcePos[0]},${sourcePos[1]}`);
            return;
        }
        
        // Choose the first available position for storageMiner
        const storageMinerPos = positions[0];
        
        // Draw storageMiner flag
        this.drawStructureVisual(roomVis, storageMinerPos, 'storageMiner', 'core');
        occupiedPositions.add(`${storageMinerPos[0]},${storageMinerPos[1]}`);
        
        // Find a position for storage next to the storageMiner
        for (let y = -1; y <= 1; y++) {
            for (let x = -1; x <= 1; x++) {
                if (x === 0 && y === 0) continue; // Skip storageMiner position
                
                const storagePos = [storageMinerPos[0] + x, storageMinerPos[1] + y];
                
                // Check if position is valid
                if (storagePos[0] <= 2 || storagePos[0] >= 47 || storagePos[1] <= 2 || storagePos[1] >= 47) continue;
                if (terrain.get(storagePos[0], storagePos[1]) === TERRAIN_MASK_WALL) continue;
                
                // Check if position is not occupied and not the source
                if (storagePos[0] === sourcePos[0] && storagePos[1] === sourcePos[1]) continue;
                
                const posKey = `${storagePos[0]},${storagePos[1]}`;
                if (occupiedPositions.has(posKey)) continue;
                
                // Draw storage here
                this.drawStructureVisual(roomVis, storagePos, STRUCTURE_STORAGE, 'core');
                occupiedPositions.add(posKey);
                console.log(`Visualized storage at ${storagePos[0]},${storagePos[1]} next to storageMiner`);
                return; // Only place one storage
            }
        }
        
        console.log(`No valid position found for storage next to storageMiner at ${storageMinerPos[0]},${storageMinerPos[1]}`);
    },

    visualizeCoreStructures: function(roomVis, bestCenterCoords, bestDirection, occupiedPositions) {
        const layout = this.STRUCTURE_LAYOUTS[bestDirection];
        console.log(`Visualizing core structures for direction ${bestDirection}, layout:`, layout);
        
        // Generate the 3x3 core using the layout coordinates directly
        Object.keys(layout).forEach(structureKey => {
            const structureData = layout[structureKey];
            const [layoutX, layoutY] = structureKey.split(',').map(Number);
            
            // Transform layout coordinates (3,3 to 5,5) to world coordinates
            // Layout coordinates are relative to center, so we offset by the center position
            const worldX = bestCenterCoords[0] - 4 + layoutX; // -4 because layout uses 3,4,5 (center at 4)
            const worldY = bestCenterCoords[1] - 4 + layoutY;
            
            console.log(`Core position ${structureKey} -> world coords (${worldX},${worldY}): ${structureData}`);
            
            this.drawStructureVisual(roomVis, [worldX, worldY], structureData, 'core');
            // Mark position as occupied
            if (occupiedPositions) {
                occupiedPositions.add(`${worldX},${worldY}`);
            }
        });
    },

    visualizePriorityStructures: function(roomVis, terrain, bestCenterCoords, bestDirection, notMainSource, roomLevel, occupiedPositions) {
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

        console.log(`Visualizing priority structures for room level ${roomLevel}, initial counts:`, structureCounts);

        // Place priority structures in expanding rings around the core
        let radius = 2;
        let placedStructures = 0;
        while (radius <= 8) {
            const positions = this.getRingPositions(bestCenterCoords, radius);
            
            for (const pos of positions) {
                const posKey = `${pos[0]},${pos[1]}`;
                
                // Skip if out of bounds
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                
                // Skip if position is already occupied
                if (occupiedPositions.has(posKey)) continue;
                
                // Skip if wall or not connected
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                if (!this.isConnectedToCenter(pos[0], pos[1], bestCenterCoords[0], bestCenterCoords[1], terrain)) continue;
                
                // Try to place next priority structure
                for (const priorityStruct of this.PRIORITY_STRUCTURES) {
                    if (roomLevel >= priorityStruct.level && 
                        structureCounts[priorityStruct.type] < priorityStruct.count) {
                        
                        console.log(`Placing ${priorityStruct.type} at ${pos[0]},${pos[1]} (radius ${radius})`);
                        this.drawStructureVisual(roomVis, pos, priorityStruct.type, 'priority');
                        structureCounts[priorityStruct.type]++;
                        placedStructures++;
                        // Mark position as occupied
                        occupiedPositions.add(posKey);
                        break;
                    }
                }
            }
            radius++;
        }
        console.log(`Placed ${placedStructures} priority structures`);
    },

    visualizeExtensionGrid: function(roomVis, terrain, bestCenterCoords, notMainSource, roomLevel, occupiedPositions) {
        const targetExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][roomLevel];
        let extensionsPlaced = 0;

        console.log(`Visualizing extension grid for room level ${roomLevel}, target: ${targetExtensions} extensions`);

        // Place extensions in checkerboard pattern around the base
        let radius = 2;
        let flipFlop = false;
        
        while (extensionsPlaced < targetExtensions && radius <= 15) {
            const positions = this.getRingPositions(bestCenterCoords, radius);
            
            for (const pos of positions) {
                if (extensionsPlaced >= targetExtensions) break;
                
                const posKey = `${pos[0]},${pos[1]}`;
                
                // Skip if out of bounds
                if (pos[0] <= 2 || pos[0] >= 47 || pos[1] <= 2 || pos[1] >= 47) continue;
                
                // Skip if position is already occupied
                if (occupiedPositions.has(posKey)) {
                    flipFlop = !flipFlop; // Still flip to maintain pattern
                    continue;
                }
                
                // Skip if wall
                if (terrain.get(pos[0], pos[1]) === TERRAIN_MASK_WALL) continue;
                if (!this.isConnectedToCenter(pos[0], pos[1], bestCenterCoords[0], bestCenterCoords[1], terrain)) continue;
                
                if (flipFlop) {
                    // Extension position
                    this.drawStructureVisual(roomVis, pos, STRUCTURE_EXTENSION, 'extension');
                    extensionsPlaced++;
                    occupiedPositions.add(posKey);
                } else {
                    // Road position
                    if (roomLevel >= 5) {
                        this.drawStructureVisual(roomVis, pos, STRUCTURE_ROAD, 'road');
                        occupiedPositions.add(posKey);
                    }
                }
                
                flipFlop = !flipFlop;
            }
            radius++;
        }
        console.log(`Placed ${extensionsPlaced} extensions`);
    },

    visualizeLinks: function(roomVis, terrain, bestCenterCoords, notMainSource, controller, occupiedPositions) {
        // Only visualize if level 5+ (when links become available)
        if (controller.level < 5) return;
        
        console.log(`Visualizing link system for level ${controller.level} room`);
        
        // 1. Visualize center link position
        this.visualizeCenterLink(roomVis, terrain, bestCenterCoords, occupiedPositions);
        
        // 2. Visualize controller link position
        this.visualizeControllerLink(roomVis, terrain, controller, occupiedPositions);
        
        // 3. Visualize source links (up to 2 near secondary source)
        if (notMainSource) {
            this.visualizeSourceLinks(roomVis, terrain, notMainSource, occupiedPositions);
        }
    },

    visualizeCenterLink: function(roomVis, terrain, bestCenterCoords, occupiedPositions) {
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
            const posKey = `${pos[0]},${pos[1]}`;
            if (occupiedPositions.has(posKey)) continue;
            
            // Visualize center link
            this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
            roomVis.text("C", pos[0], pos[1] - 0.2, { 
                color: '#00ff00', 
                font: 0.4, 
                stroke: '#000000', 
                strokeWidth: 0.1 
            });
            occupiedPositions.add(posKey);
            return;
        }
    },

    visualizeControllerLink: function(roomVis, terrain, controller, occupiedPositions) {
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
                    const posKey = `${pos[0]},${pos[1]}`;
                    if (occupiedPositions.has(posKey)) continue;
                    
                    // Visualize controller link
                    this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
                    roomVis.text("U", pos[0], pos[1] - 0.2, { 
                        color: '#0099ff', 
                        font: 0.4, 
                        stroke: '#000000', 
                        strokeWidth: 0.1 
                    });
                    occupiedPositions.add(posKey);
                    return;
                }
            }
        }
    },

    visualizeSourceLinks: function(roomVis, terrain, notMainSource, occupiedPositions) {
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
                const posKey = `${pos[0]},${pos[1]}`;
                if (occupiedPositions.has(posKey)) continue;
                
                linkPositions.push(pos);
            }
        }
        
        // Visualize up to 2 source links, but leave at least one free space for miners
        const maxLinksToPlace = Math.min(2, linkPositions.length - 1);
        
        for (let i = 0; i < maxLinksToPlace; i++) {
            const pos = linkPositions[i];
            const posKey = `${pos[0]},${pos[1]}`;
            
            // Visualize source link
            this.drawStructureVisual(roomVis, pos, STRUCTURE_LINK, 'link');
            roomVis.text("S", pos[0], pos[1] - 0.2, { 
                color: '#ffaa00', 
                font: 0.4, 
                stroke: '#000000', 
                strokeWidth: 0.1 
            });
            occupiedPositions.add(posKey);
            linksPlaced++;
        }
        
        console.log(`Visualized ${linksPlaced} source links near secondary source`);
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
        // Pattern 1: Central reactor with surrounding input labs (max range 2)
        const labClusterPatterns = [
            {
                // 3x3 cluster with central reactor
                positions: [
                    { x: 0, y: 0, type: 'reactor' },    // Center reactor
                    { x: -1, y: -1, type: 'input' },   // Input labs around it
                    { x: 0, y: -1, type: 'input' },
                    { x: 1, y: -1, type: 'input' },
                    { x: -1, y: 0, type: 'input' },
                    { x: 1, y: 0, type: 'input' },
                    { x: -1, y: 1, type: 'input' },
                    { x: 0, y: 1, type: 'input' },
                    { x: 1, y: 1, type: 'input' },
                    { x: 2, y: 0, type: 'input' },     // Additional lab within range 2
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
                        const roomPos = new RoomPosition(worldX, worldY, thisRoom.name);
                        const structures = roomPos.lookFor(LOOK_STRUCTURES);
                        const sites = roomPos.lookFor(LOOK_CONSTRUCTION_SITES);
                        if (structures.length > 0 || sites.length > 0) {
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
                            if (thisRoom.controller.level >= 7) {
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

    visualizeLabClusters: function(roomVis, terrain, bestCenterCoords, roomLevel, occupiedPositions) {
        if (roomLevel < 6) return; // Labs available at level 6
        
        const targetLabs = CONTROLLER_STRUCTURES[STRUCTURE_LAB][roomLevel];
        let labsPlaced = 0;
        
        console.log(`Visualizing lab clusters for room level ${roomLevel}, target: ${targetLabs} labs`);
        
        // Define the same lab cluster patterns as in generation
        const labClusterPatterns = [
            {
                positions: [
                    { x: 0, y: 0, type: 'reactor' },
                    { x: -1, y: -1, type: 'input' },
                    { x: 0, y: -1, type: 'input' },
                    { x: 1, y: -1, type: 'input' },
                    { x: -1, y: 0, type: 'input' },
                    { x: 1, y: 0, type: 'input' },
                    { x: -1, y: 1, type: 'input' },
                    { x: 0, y: 1, type: 'input' },
                    { x: 1, y: 1, type: 'input' },
                    { x: 2, y: 0, type: 'input' },
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
                    
                    // If we can place the cluster, visualize it
                    if (canPlaceCluster) {
                        let labsInThisCluster = 0;
                        for (let i = 0; i < clusterPositions.length && labsPlaced < targetLabs; i++) {
                            const { pos, type } = clusterPositions[i];
                            
                            // Draw lab with different color for reactor vs input
                            if (type === 'reactor') {
                                roomVis.circle(pos[0], pos[1], {
                                    radius: 0.3,
                                    fill: '#ff6600', // Orange for reactor labs
                                    stroke: '#000000',
                                    strokeWidth: 0.1
                                });
                                roomVis.text('R', pos[0], pos[1] + 0.1, {
                                    color: '#ffffff',
                                    font: '0.4',
                                    align: 'center'
                                });
                            } else {
                                this.drawStructureVisual(roomVis, pos, STRUCTURE_LAB, 'lab');
                            }
                            
                            occupiedPositions.add(`${pos[0]},${pos[1]}`);
                            labsPlaced++;
                            labsInThisCluster++;
                        }
                        
                        console.log(`Visualized lab cluster of ${labsInThisCluster} labs at radius ${radius}`);
                        
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
        
        console.log(`Visualized ${labsPlaced} total labs in clusters`);
    },

    drawLegend: function(roomVis) {
        // Draw a legend showing structure meanings
        roomVis.text("Base Generation Legend:", 1, 1, { 
            color: '#ffffff', 
            font: 0.6, 
            stroke: '#000000', 
            strokeWidth: 0.1 
        });
        
        roomVis.text("Labs: Orange=Reactor, Purple=Input", 1, 2, { 
            color: '#cccccc', 
            font: 0.4 
        });
        
        roomVis.text("Links: C=Center, U=Upgrader, S=Source", 1, 2.5, { 
            color: '#cccccc', 
            font: 0.4 
        });
        
        roomVis.text("Storage: Green circle", 1, 3, { 
            color: '#cccccc', 
            font: 0.4 
        });
    },

    drawStructureVisual: function(roomVis, pos, structureType, category) {
        const x = pos[0];
        const y = pos[1];
        
        // Different visualization styles based on structure type and category
        switch (structureType) {
            case STRUCTURE_SPAWN:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#ffaa00',
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                break;
                
            case STRUCTURE_ROAD:
                roomVis.circle(x, y, {
                    radius: 0.15,
                    fill: '#666666',
                    stroke: '#000000',
                    strokeWidth: 0.05
                });
                break;
                
            case STRUCTURE_STORAGE:
                roomVis.circle(x, y, {
                    radius: 0.4,
                    fill: '#00ff00',
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    fill: '#aa00ff', // Purple for input labs
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
                });
                roomVis.text('LK', x, y + 0.1, {
                    color: '#ffffff',
                    font: '0.3',
                    align: 'center'
                });
                break;
                
            case 'supply':
                roomVis.circle(x, y, {
                    radius: 0.2,
                    fill: '#00ff88',
                    stroke: '#000000',
                    strokeWidth: 0.1
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
                    stroke: '#000000',
                    strokeWidth: 0.1
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
};

module.exports = tool_generateBase;
