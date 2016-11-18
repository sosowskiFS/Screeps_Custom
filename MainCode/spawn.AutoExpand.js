var spawn_AutoExpand = {
	run: function(spawn, controllerLevel) {
		var AvailableExtensions = 5;
		if (controllerLevel >= 4) {AvailableExtensions = 10;}
		var Curs_Pos = spawn.pos;
		Curs_Pos.y = Curs_Pos.y - 1;
		var startingPoint = Curs_Pos;
		//Starting at upper left
		Curs_Pos.x = Curs_Pos.x - 1;
		var MaxDist = 1;
		var Direction = 0; //0: s, 1: e, 2: n, 3: w
		var NextToBuilding = false;

		//TODO: Get object at coords if blocked, if structure set NextToBuilding and don't attempt to build on next tile.
		while (AvailableExtensions > 0){
			//Spin in clockwise circle, go out another layer when starting position reached.
			//ABORT LOOP IF ERR_FULL, ERR_INVALID_ARGS, ERR_RCL_NOT_ENOUGH
			if(createConstructionSite(Curs_Pos, STRUCTURE_EXTENSION) == ERR_INVALID_TARGET) {
				//Move to move_cursor function.
				if (Math.abs(spawn.pos.y - Curs_Pos.y) == MaxDist && Math.abs(spawn.pos.x - Curs_Pos.x) == MaxDist) {
					//Corners
					switch(Direction) {
						case 0:
							Curs_Pos.y++;
							break;
						case 1:
							Curs_Pos.x++;
							break;
						case 2:
							Curs_Pos.y--;
							break;
						case 3:
							Curs_Pos.x--;
							break;
					}
				}
			} else {
				AvailableExtensions--;
			}	
		}
	}
};

module.exports = spawn_AutoExpand;