var special = {
    specialInstruction: function(instruction, param1, param2 = '') {
        //Special calls, call this function from the console.
        switch (instruction) {
            case 'claim':
                Memory.Instruction = 'claim';
                Memory.InstructionOps = param1;
                console.log('Claim instruction set, target: ' + param1);
                break;
            case 'vandalize':
                Memory.Instruction = 'vandalize';
                Memory.InstructionOps = param1;
                Memory.InstructionOps2 = param2;
                console.log('Vandalize instruction set, targets: ' + param1 + ', message: ' + param2);
                break;
            case 'construct':
                Memory.Instruction = 'construct';
                Memory.InstructionOps = param1;
                Memory.InstructionOps2 = param2;
                console.log('Construct instruction set, targetID: ' + param1 + ', room: ' + param2);
                break;
            case 'removeKebab':
                Memory.Instruction = 'removeKebab';
                Memory.InstructionOps = param1;
                Memory.InstructionOps2 = param2;
                console.log('Kebab removal instruction set, targetID: ' + param1 + ', room: ' + param2);
                break;
        }
    }
};

module.exports = special;