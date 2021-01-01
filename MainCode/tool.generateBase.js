var tool_generateBase = {
	//Direction references are based on keyboard numpad

    run: function(thisRoom) {
        //Step 1 - Check both room sources
        	//Determine if minimum 5x5 square diagonal from source is available
        	//If so, get count of free spaces in the total 11x11 space
        	//If both valid, more free space source is winner
        		//Check to see if free space overlaps room border + 1 - cannot build structures here
       	const terrain = new Room.Terrain(thisRoom.name);
        let roomSources = thisRoom.find(FIND_SOURCES);
        let bestCenterCoords = undefined;
        let bestDirection = undefined;
        let bestFreeSpace = 0;

        for (let thisSource in roomSources) {
        	//Find open space diagonal from source
        		//If multiple, check all for best layout. (probably rare)
        	let sourceCoords = [roomSources[thisSource].pos.x, roomSources[thisSource].pos.y];
        	let validDiagonals = [];
			//Pos 7
			if (terrain.get(sourceCoords[0] - 1, sourceCoords[1] - 1) != TERRAIN_MASK_WALL) {
				validDiagonals.push(7);
			}
			//Pos 9
			if (terrain.get(sourceCoords[0] + 1, sourceCoords[1] - 1) != TERRAIN_MASK_WALL) {
				validDiagonals.push(9);
			}
			//Pos 3
			if (terrain.get(sourceCoords[0] + 1, sourceCoords[1] + 1) != TERRAIN_MASK_WALL) {
				validDiagonals.push(3);
			}
			//Pos 1
			if (terrain.get(sourceCoords[0] - 1, sourceCoords[1] + 1) != TERRAIN_MASK_WALL) {
				validDiagonals.push(1);
			}

			if (!validDiagonals.length) {
				//No valid diagonals, not suitable
				continue;
			}

			//Determine if 5x5 space is available from diagonals, with found space at bottom corner
			let badDiagonals = [];
			for(let thisDirection in validDiagonals) {
				let xMinMax = [];
				let yMinMax = [];
				switch (thisDirection) {
					case 7:
						xMinMax = [sourceCoords[0] - 5, sourceCoords[0] - 1];
						yMinMax = [sourceCoords[1] - 5, sourceCoords[1] - 1];
						break;
					case 9:
						xMinMax = [sourceCoords[0] + 1, sourceCoords[0] + 5];
						yMinMax = [sourceCoords[1] - 5, sourceCoords[1] - 1];
						break;
					case 3:
						xMinMax = [sourceCoords[0] + 1, sourceCoords[0] + 5];
						yMinMax = [sourceCoords[1] + 1, sourceCoords[1] + 5];
						break;
					case 1:
						xMinMax = [sourceCoords[0] - 5, sourceCoords[0] - 1];
						yMinMax = [sourceCoords[1] + 1, sourceCoords[1] + 5];
						break;
				}
				if (!xMinMax.length) {
					badDiagonals.push(thisDirection);
					continue;
				}

				//Determine if coordinates overlap map edge
				if (
					xMinMax[0] <= 1 || 
					xMinMax[0] >= 48 ||
					xMinMax[1] <= 1 || 
					xMinMax[1] >= 48 ||
					yMinMax[0] <= 1 || 
					yMinMax[0] >= 48 ||
					yMinMax[1] <= 1 || 
					yMinMax[1] >= 48 
				) {
					badDiagonals.push(thisDirection);
					continue;
				}

				//Ensure all tiles in this range are free
				let validSpace = true;
				for (let y = yMinMax[0]; y <= yMinMax[1]; y++){
					for (let x = xMinMax[0]; x <= xMinMax[1]; x++) {
						if (terrain.get(x, y) == TERRAIN_MASK_WALL) {
							validSpace = false;
						}
					}
				}

				if (!validSpace) {
					badDiagonals.push(thisDirection);
					continue;
				}
			}

			//Splice out bad directions
			for (let thisDirection in badDiagonals) {
				let badPos = validDiagonals.indexOf(thisDirection);
				if (badPos >= 0) {
					validDiagonals.splice(badPos, 1);
				}
			}

			if (!validDiagonals.length) {
				//No valid diagonals, not suitable
				continue;
			}

			//Diagonals have a minimum of 5x5 space at this point.
			//Compare diagonals and determine which has the most free space in 11x11 area
				//If 11x11 area is intersected by room borders, mark this as not valid.
			let mostSpace = 0;
			let bestDiagonal = undefined;
			let bestCenter = undefined;;
			for(let thisDirection in validDiagonals) {
				let centerPoint = []
				let xMinMax = [];
				let yMinMax = [];
				switch (thisDirection) {
					case 7:
						centerPoint = [sourceCoords[0] - 3, sourceCoords[1] - 3]
						break;
					case 9:
						centerPoint = [sourceCoords[0] + 3, sourceCoords[1] - 3]
						break;
					case 3:
						centerPoint = [sourceCoords[0] + 3, sourceCoords[1] + 3]
						break;
					case 1:
						centerPoint = [sourceCoords[0] - 3, sourceCoords[1] + 3]
						break;
				}
				xMinMax = [centerPoint[0] - 5, sourceCoords[0] + 5];
				yMinMax = [sourceCoords[1] - 5, sourceCoords[1] + 5];

				//Determine if coordinates overlap map edge
				if (
					xMinMax[0] <= 1 || 
					xMinMax[0] >= 48 ||
					xMinMax[1] <= 1 || 
					xMinMax[1] >= 48 ||
					yMinMax[0] <= 1 || 
					yMinMax[0] >= 48 ||
					yMinMax[1] <= 1 || 
					yMinMax[1] >= 48 
				) {
					continue;
				}

				//Count free space in this area
				let freeSpace = 0;
				for (let y = yMinMax[0]; y <= yMinMax[1]; y++){
					for (let x = xMinMax[0]; x <= xMinMax[1]; x++) {
						if (terrain.get(x, y) != TERRAIN_MASK_WALL) {
							freeSpace++;
						}
					}
				}

				if (freeSpace > mostSpace) {
					bestDiagonal = thisDirection;
					bestCenter = centerPoint;
					mostSpace = freeSpace;
				}
			}

			if (!bestDiagonal) {
				//Nothing passed the check
				continue;
			} else if (mostSpace > bestFreeSpace) {
				//Winner (for now)
				bestCenterCoords = bestCenter;
		        bestDirection = bestDiagonal;
		        bestFreeSpace = mostSpace;
			}
        }

        //(Above step is fully completed)

        if (!bestCenterCoords) {
        	console.log('No plannable sources located.')
        } else {
        	//Step 2 - Plan roads & any available structures
        		//First spawn is always middle, to provide supplier
        		//Pathfind a road to other source from the nearest base corner

        	//Calls to this function after initial planning should skip to here to regenerate structures
        	/* Template - S can be any corner of center 5X5
			_O_O_O_O_O_
			O_O_O_O_O_O
			_O_O_O_O_O_
			O_OXXXXXO_O
			_O_XXXXX_O_
			O_OXXCXXO_O
			_O_XXXXX_O_
			O_OXXXXXO_O
			_OSO_O_O_O_
			O_O_O_O_O_O
			_O_O_O_O_O_
			*/
			let thisCursor = [bestCenterCoords[0] - 5, bestCenterCoords[1] - 5];
			//false - Space/Road
			//true - Extention
			let flipFlop = false

			for (let y = 0; y <= 10; y++) {
				let isSpecialRow = false;
				if (y >= 3 && y <= 7) {
					isSpecialRow = true;
				}
				for (let x = 0; x <= 10; x++) {
					if (isSpecialRow && x >= 3 && x <= 7) {
						switch(y) {
							case 3:
								switch(x) {
									case 3:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_FACTORY)
										break;
									case 4:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_NUKER)
										break;
									case 5:
										if (thisRoom.controller.level >= 7) {
											thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
										}									
										break;
									case 6:
									case 7:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
										break;
								}
								break;
							case 4:
								switch(x) {
									case 3:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TERMINAL)
										break;
									case 4:
									case 5:
									case 6:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
										break;
									case 7:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
										break;
								}
								break;
							case 5:
								switch(x) {
									case 3:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
										break;
									case 4:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
										break;
									case 5:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_RAMPART)
										break;
									case 6:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
										break;
									case 7:
										if (thisRoom.controller.level >= 7) {
											thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
										}	
										break;
								}
								break;
							case 6:
								switch(x) {
									case 3:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
										break;
									case 4:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_STORAGE)
										break;
									case 5:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
										break;
									case 6:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
										break;
									case 7:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_OBSERVER)
										break;
								}
								break;
							case 7:
								switch(x) {
									case 3:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
										break;
									case 4:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
										break;
									case 5:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
										break;
									case 6:
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_POWER_SPAWN)
										break;
									case 7:
										if (thisRoom.controller.level >= 6) {
											thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LINK)
										}
										break;
								}
								break;
						}
					} else if (flipFlop) {
						//Extention/Rampart
						thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_EXTENSION)
						thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_RAMPART)
					} else {
						//Road/Rampart
						thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
						thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_RAMPART)
					}
				}
			}
        }
        
        //Step 3 - Generate extention blocks when out of space
        	//Need to create prefab of extentions if out of room in main base
        		//7 Lab production prefab as well
        	//Extentions & roads outside of main base should be covered with ramparts
        	//Should check if prefabs can fit outside of main base before confirming valid placement
        		//Prefab concept should be flat against outer walls if possible
    }
};

module.exports = tool_generateBase;