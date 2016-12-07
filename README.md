# Screeps - My Personal Build
My codebase for Screeps, main room is currently E3N61, and this month's expansion rank is about 385. Search for the user "Montblanc" if you want to see the code in action.

This codebase is structured to give creeps designated roles and targets, with the overall aim of keeping CPU moderately low.

Creeps in low level controlled rooms prioritize their role, but work universally if their role is not needed. CPU usage is generally higher in these rooms.

**Harvester** - Mines and distributes energy

**Builder** - Mines and builds construction sites

**Upgrader** - Maintains room controller

Creeps in higher level controlled rooms are more structured, strictly performing their roles while utilizing the least amount of find and move functions as possible. Creep builds at this level are designed to be the lowest cost possible while also extracting all available energy from sources before regenerating.

**Miner** - Stationary miner, one for each source. Deposits energy in some storage unit right next to it.

**Mule** - Hauls energy from room's storage unit to Spawn, extentions, towers, construction sites, and finally the room controller

**Upgrader** - Maintains room controller. Gets it's energy from a link connected to one of the miners.

**Repairer** - Performs the never-ending job of endlessly upgrading walls and ramparts

**MineralMiner** - Extracts minerals, duh.

There are some special, manually created creep roles as well:

**Claimer** - Creep designed to control, not reserve, a distant room

**Constructor** - Given a target room, creep will mine and construct in specified room. Used to follow up after Claimer

**Vandal** - Rushes through a list of rooms to go to each room's controller and write the specified message on the sign. Now you too can be a blight on society!

Construction sites and specific IDs are entered manually to save on CPU usage. Future updates should change this to write IDs to memory.

Currently this codebase runs two rooms at an average of 7 CPU, though it currently expereinces occasional spikes of 25 CPU due to using built-in pathfinding.

Yes, I understand the "risks" of making this public. I regret nothing. Or at least until I get nuked and raided, then maybe I'll think about regretting it.

Oh yes, and I'm perfectly ok with you stealing code from this. I accept no responsibility for catastrophic economic failure. 
