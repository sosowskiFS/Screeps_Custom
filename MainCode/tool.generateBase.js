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
        let bestSourceID = undefined;

        if (!Memory.genBestCenterCoords[thisRoom.name]) {
        	for (let thisSource in roomSources) {
	        	//Find open space diagonal from source
	        		//If multiple, check all for best layout. (probably rare)
	        	let sourceCoords = [roomSources[thisSource].pos.x, roomSources[thisSource].pos.y];
	        	console.log('--- SOURCE:' + roomSources[thisSource].id + ' ---')
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
				
				console.log('Passed Diagonal Check.')

				//Determine if 5x5 space is available from diagonals, with found space at bottom corner
				let badDiagonals = [];
				for(let thisDirection in validDiagonals) {
					let xMinMax = [];
					let yMinMax = [];
					switch (validDiagonals[thisDirection]) {
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
						badDiagonals.push(validDiagonals[thisDirection]);
						console.log('did not set xMinMax in first test')
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
					    console.log('5x5 is too close to room border')
						badDiagonals.push(validDiagonals[thisDirection]);
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
					    console.log('Not all tiles in 5x5 space are free')
						badDiagonals.push(validDiagonals[thisDirection]);
						continue;
					}
				}

				//Splice out bad directions
				for (let thisDirection in badDiagonals) {
				    console.log(badDiagonals[thisDirection]);
					let badPos = validDiagonals.indexOf(badDiagonals[thisDirection]);
					if (badPos >= 0) {
						validDiagonals.splice(badPos, 1);
					}
				}

				if (!validDiagonals.length) {
					//No valid diagonals, not suitable
					console.log('No valid directions here, quitting.')
					continue;
				}

				//Diagonals have a minimum of 5x5 space at this point.
				//Compare diagonals and determine which has the most free space in 11x11 area
					//If 11x11 area is intersected by room borders, mark this as not valid.
				let mostSpace = 0;
				let bestDiagonal = undefined;
				let bestCenter = undefined;
				for(let thisDirection in validDiagonals) {
					let centerPoint = []
					let xMinMax = [];
					let yMinMax = [];
					switch (validDiagonals[thisDirection]) {
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
					    console.log('11x11 area overlaps map edge')
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
						bestDiagonal = validDiagonals[thisDirection];
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
			        bestSourceID = roomSources[thisSource].id;
				}
	        }

	        /*console.log('Best location determined.')
	        console.log(bestCenterCoords[0] + ',' + bestCenterCoords[1]);
	        console.log('Direction ' + bestDirection);
	        console.log('Most Space ' + bestFreeSpace);*/

	        if (!Memory.genBestDirection[thisRoom.name]) { 
	        	Memory.genBestDirection[thisRoom.name] = bestDirection;
		    }
		    if (!Memory.genBestCenterCoords[thisRoom.name]) {
		        Memory.genBestCenterCoords[thisRoom.name] = bestCenterCoords;
		    }
		    if (!Memory.genBestSourceID[thisRoom.name]) {
		        Memory.genBestSourceID[thisRoom.name] = bestSourceID;
		    }
        }


        if (!Memory.genBestCenterCoords[thisRoom.name]) {
        	console.log('No plannable sources located.')
        } else {
        	bestCenterCoords = Memory.genBestCenterCoords[thisRoom.name];
        	bestDirection = Memory.genBestDirection[thisRoom.name];
        	bestSourceID = Memory.genBestSourceID[thisRoom.name]
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
			

        	let notMainSource = undefined;
			for (let thisSource in roomSources) {
				if (roomSources[thisSource].id != bestSourceID) {
					notMainSource = roomSources[thisSource]
				}
			}

			//Keep a record of extension sites created from below loop
			let totalExtensions = 0

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
										switch(bestDirection) {
											case 1:
												if (thisRoom.controller.level >= 6) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LINK)
												}
												break;
											case 3:
												//Nothing
												if (!Game.flags[thisRoom.name + "storageMiner"]) {
													thisRoom.createFlag(thisCursor[0] + x, thisCursor[1] + y, thisRoom.name + "storageMiner");
												}
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_FACTORY)
												break;
										}										
										break;
									case 4:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_POWER_SPAWN)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_NUKER)
												break;
										}							
										break;
									case 5:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 7:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}
												break;
											case 9:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}	
												break;
										}										
										break;
									case 6:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TERMINAL)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_OBSERVER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
										}
										break;
									case 7:
										switch(bestDirection) {
											case 1:
												//Nothing
												if (!Game.flags[thisRoom.name + "storageMiner"]) {
													thisRoom.createFlag(thisCursor[0] + x, thisCursor[1] + y, thisRoom.name + "storageMiner");
												}
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_FACTORY)
												break;
											case 7:
												if (thisRoom.controller.level >= 6) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LINK)
												}
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
										}
										break;
								}
								break;
							case 4:
								switch(x) {
									case 3:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_OBSERVER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TERMINAL)
												break;
										}
										break;
									case 4:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_STORAGE)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
										}
										break;
									case 5:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
										}
										break;
									case 6:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_STORAGE)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
										}
										break;
									case 7:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_NUKER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_POWER_SPAWN)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
										}
										break;
								}
								break;
							case 5:
								switch(x) {
									case 3:
										switch(bestDirection) {
											case 1:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 7:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
										}
										break;
									case 4:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
										}
										break;
									case 5:
										//Dead middle
										thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_RAMPART)
										if (!Game.flags[thisRoom.name + "Supply"]) {
											thisRoom.createFlag(thisCursor[0] + x, thisCursor[1] + y, thisRoom.name + "Supply");
										}
										break;
									case 6:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
										}							
										break;
									case 7:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 3:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 9:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}	
												break;
										}							
										break;
								}
								break;
							case 6:
								switch(x) {
									case 3:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_POWER_SPAWN)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_NUKER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
										}	
										break;
									case 4:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_STORAGE)
												break;
										}					
										break;
									case 5:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												break;
										}
										break;
									case 6:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_STORAGE)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TOWER)
												break;
										}						
										break;
									case 7:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TERMINAL)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_OBSERVER)
												break;
										}						
										break;
								}
								break;
							case 7:
								switch(x) {
									case 3:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 3:
												if (thisRoom.controller.level >= 6) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LINK)
												}
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_FACTORY)
												break;
											case 9:
												//Nothing
												if (!Game.flags[thisRoom.name + "storageMiner"]) {
													thisRoom.createFlag(thisCursor[0] + x, thisCursor[1] + y, thisRoom.name + "storageMiner");
												}
												break;
										}						
										break;
									case 4:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_OBSERVER)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_TERMINAL)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
										}
										break;
									case 5:
										switch(bestDirection) {
											case 1:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}
												break;
											case 3:
												if (thisRoom.controller.level >= 7) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_SPAWN)
												}
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
										}
										break;
									case 6:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_NUKER)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 7:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
												break;
											case 9:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_POWER_SPAWN)
												break;
										}						
										break;
									case 7:
										switch(bestDirection) {
											case 1:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_FACTORY)
												break;
											case 3:
												thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LAB)
												break;
											case 7:
												//Nothing
												if (!Game.flags[thisRoom.name + "storageMiner"]) {
													thisRoom.createFlag(thisCursor[0] + x, thisCursor[1] + y, thisRoom.name + "storageMiner");
												}
												break;
											case 9:
												if (thisRoom.controller.level >= 6) {
													thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_LINK)
												}
												break;
										}				
										break;
								}
								break;
						}
					} else if (flipFlop) {
						//Extention/Rampart				
						if (terrain.get(thisCursor[0] + x, thisCursor[1] + y) != TERRAIN_MASK_WALL) {
							if (determineConnection(thisCursor[0] + x, thisCursor[1] + y, bestCenterCoords[0], bestCenterCoords[1], terrain)) {
								let roomPos = new RoomPosition(thisCursor[0] + x, thisCursor[1] + y, thisRoom.name)
								if (!roomPos.inRangeTo(thisRoom.controller, 2) && !roomPos.inRangeTo(notMainSource, 2)) {
									thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_EXTENSION)
									totalExtensions += 1
								}						
								if (thisRoom.controller.level >= 7) {
									thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_RAMPART)
								}
							}								
						}
					} else {
						//Road/Rampart
						if (terrain.get(thisCursor[0] + x, thisCursor[1] + y) != TERRAIN_MASK_WALL) {
							if (determineConnection(thisCursor[0] + x, thisCursor[1] + y, bestCenterCoords[0], bestCenterCoords[1], terrain)) {
								if (thisRoom.controller.level >= 7) {								
									thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_RAMPART)
								}
								if (thisRoom.controller.level >= 5) {
									thisRoom.createConstructionSite(thisCursor[0] + x, thisCursor[1] + y, STRUCTURE_ROAD)
								}
							}
						}
					}
					flipFlop = !flipFlop;
				}
			}

			//Step 3 - Continue lattice extension drawing to extend walls as needed
	        let targetExtensions = CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][thisRoom.controller.level]

	        if (totalExtensions < targetExtensions) {
	        	//Loop until target reached.
	        	let loopDim = 6
	        	let xOff = -6;
	        	let yOff = -6;
	        	let flipFlop = false;
	        	let moveStep = 1;

	        	//base corner is always rampart, always start with rampart

	        	//This should loop until all extentions are accounted for - search each location for an extention structure while looping.
	        		//This will build ramparts & roads where needed.
	        	while (totalExtensions < targetExtensions) {
	        		if (determineConnection(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff, bestCenterCoords[0], bestCenterCoords[1], terrain)) {
	        			if (terrain.get(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff) != TERRAIN_MASK_WALL) {
		        			if (flipFlop) {
								let roomPos = new RoomPosition(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff, thisRoom.name)
								if (!roomPos.inRangeTo(thisRoom.controller, 2) && !roomPos.inRangeTo(notMainSource, 2)) {
									thisRoom.createConstructionSite(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff, STRUCTURE_EXTENSION)
									totalExtensions += 1
								}	
								if (thisRoom.controller.level >= 7) {
									thisRoom.createConstructionSite(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff, STRUCTURE_RAMPART)
								}
		        			} else {
		        				if (thisRoom.controller.level >= 7) {								
									thisRoom.createConstructionSite(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff, STRUCTURE_RAMPART)
								}
								if (thisRoom.controller.level >= 5) {
									thisRoom.createConstructionSite(bestCenterCoords[0] + xOff, bestCenterCoords[1] + yOff, STRUCTURE_ROAD)
								}
		        			}
		        		}
	        		}
	        		flipFlop = !flipFlop;
	        		//Increment pointers
	        		switch (moveStep) {
	        			case 1:
	        				//Top
	        				xOff += 1;
	        				if (xOff > loopDim) {
	        					moveStep = 2;
	        					xOff = loopDim;
	        					yOff = loopDim * -1;
	        					flipFlop = false;
	        				}
	        				break;
	        			case 2:
	        				//Right
	        				yOff += 1;
	        				if (yOff > loopDim) {
	        					moveStep = 3;
	        					xOff = loopDim * -1;
	        					yOff = loopDim * -1;
	        					flipFlop = false;
	        				}
	        				break;
	        			case 3:
	        				//Left
	        				yOff += 1;
	        				if (yOff > loopDim) {
	        					moveStep = 4;
	        					xOff = loopDim * - 1;
	        					yOff = loopDim;
	        					flipFlop = false;
	        				}
	        				break;
	        			case 4:
	        				//Bottom
	        				xOff += 1;
	        				if (xOff > loopDim) {
	        					loopDim += 1;
	        					moveStep = 1;
	        					xOff = loopDim * - 1;
	        					yOff = loopDim * - 1;
	        					flipFlop = false;
	        				}
	        				break;
	        		}
	        	}
	        }

	        //Step 4 - Generate Links

	        //Piggyback on a harvester's natural pathfinding to place upgradeMiner flag
	        if (!Game.flags[thisRoom.name + "upgradeMiner"]) {
				let harvesters = notMainSource.pos.findInRange(FIND_MY_CREEPS, 1, {
	                filter: (thisCreep) => (thisCreep.memory.priority == 'harvester' && thisCreep.memory.sourceLocation == notMainSource.id)
	            });
		        if (harvesters.length) {
		        	thisRoom.createFlag(harvesters[0].pos, thisRoom.name + "upgradeMiner");
		        }
	        }

	        //Find free spot(s) for upgrade miner links and upgrader link
	        if (Game.flags[thisRoom.name + "upgradeMiner"] && thisRoom.controller.level >= 5) {
	        	let linkOffsetX = -1
	        	let linkOffsetY = -1
	        	let linkCursor = [Game.flags[thisRoom.name + "upgradeMiner"].pos.x, Game.flags[thisRoom.name + "upgradeMiner"].pos.y]
	        	let placedLinks = 0
	        	let linkCap = 1
	        	if (thisRoom.controller.level >= 7) {
	        		linkCap = 2
	        	}
	        	//Miner loop
	        	while(placedLinks < linkCap) {
	        		if (linkOffsetX == 0 && linkOffsetY == 0) {
	        			linkOffsetX += 1
	        		}

	        		if (terrain.get(linkCursor[0] + linkOffsetX, linkCursor[1] + linkOffsetY) != TERRAIN_MASK_WALL) {
	        			thisRoom.createConstructionSite(linkCursor[0] + linkOffsetX, linkCursor[1] + linkOffsetY, STRUCTURE_LINK)
	        			placedLinks += 1 
	        		}
	        			
        			linkOffsetX += 1
        			if (linkOffsetX >= 2) {
        				linkOffsetX = -1;
        				linkOffsetY += 1
        			}

        			if (linkOffsetY >= 2) {
        				//Couldn't find space
        				placedLinks = 99
        			}
	        	}
	        	placedLinks = 0;

	        	//Upgrader loop
	        	linkCap = 1
	        	linkOffsetX = -2;
	        	linkOffsetY = -2;
	        	linkCursor = [thisRoom.controller.pos.x, thisRoom.controller.pos.y]
	        	while(placedLinks < linkCap) {
	        		if (terrain.get(linkCursor[0] + linkOffsetX, linkCursor[1] + linkOffsetY) != TERRAIN_MASK_WALL) {
	        			thisRoom.createConstructionSite(linkCursor[0] + linkOffsetX, linkCursor[1] + linkOffsetY, STRUCTURE_LINK)
	        			placedLinks += 1
	        		} else {
	        			switch(linkOffsetY) {
	        				case -2:
	        				case 2:
	        					linkOffsetX += 1;
	        					break;
	        				default:
	        					if (linkOffsetX == 2) {
	        						linkOffsetX = 3
	        					} else {
	        						linkOffsetX = 2;
	        					}	        					
	        					break;
	        			}
	        			if (linkOffsetX > 2) {
	        				linkOffsetY += 1
	        			}
	        			
	        			if (linkOffsetY > 2) {
	        				//Couldn't find space
	        				placedLinks = 99
	        			}
	        		}
	        	}

	        }	        
        }
    }
};

function determineConnection(x, y, cenX, cenY, terrain) {
	//First determine if initial coords are past room bounds
	if (
		x <= 1 || 
		x >= 48 ||
		y <= 1 || 
		y >= 48
	) {
	    return false;
	}


	//Draw a line to room center & determine if terrain is blocking
	let xPointer = x;
	let yPointer = y;

	while (xPointer  != cenX && yPointer != cenY) {
		if (xPointer < cenX) {
			xPointer  += 1
		} else if (xPointer > cenX) {
			xPointer  -= 1
		}

		if (yPointer < cenY) {
			yPointer += 1
		} else if (yPointer > cenY) {
			yPointer -= 1
		}

		if (terrain.get(xPointer, yPointer) == TERRAIN_MASK_WALL) {
			//Assume this spot is cut off from main
			return false;
		}
	}

	return true;
}

module.exports = tool_generateBase;