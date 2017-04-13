Creep.prototype.shunt = function() {
	let {
		path
	} = PathFinder.search(this.pos, {
		pos: this.pos,
		range: 1
	}, {
		flee: true
	});
	return this.move(this.pos.getDirectionTo(path[0]));
}