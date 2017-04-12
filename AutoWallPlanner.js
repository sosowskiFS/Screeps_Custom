static exitPlanner(roomName, opts = {}) {
	opts = _.defaults(opts, {
		visualize: true,
		commit: false,
	});
	var cm = new PathFinder.CostMatrix;
	var room = Game.rooms[roomName];
	// var visual = room.visual;		
	var visual = new RoomVisual(roomName);
	if (room) {
		if (!opts.origin)
			opts.origin = _.create(RoomPosition.prototype, room.memory.origin);
		if (!opts.origin) {
			Log.warn('No origin');
			return;
		}
		var exits = room.find(FIND_EXIT).map(e => ({
			pos: e,
			range: 0
		}));
		room.find(FIND_STRUCTURES).forEach(({
			pos, structureType
		}) => {
			if (structureType === STRUCTURE_RAMPART || OBSTACLE_OBJECT_TYPES.includes(structureType))
				cm.set(pos.x, pos.y, 255);
		});
	} else {
		console.log('No room object');
	}
	while (true) {
		var {
			path, incomplete
		} = PathFinder.search(opts.origin, exits, {
			roomCallback: () => cm,
			maxRooms: 1
		});
		if (incomplete)
			break;
		console.log(JSON.stringify(path));
		var pos = path[path.length - 3];
		cm.set(pos.x, pos.y, 255);
		var wallOrRampart = (pos.x + pos.y) % 2;
		if (opts.commit) {
			var type = (wallOrRampart ? STRUCTURE_WALL : STRUCTURE_RAMPART);
			if (pos.hasStructure(type))
				continue;
			room.addToBuildQueue(pos, type);
		}
		if (opts.visualize) {
			visual.poly(path);
			// visual.circle(pos, {fill:(wallOrRampart?'black':'green'), opacity: 0.75});
			visual.circle(pos, {
				fill: 'red',
				opacity: 0.75
			});
		}
	}
}