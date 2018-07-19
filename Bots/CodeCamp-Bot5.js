'use strict';

// Russell Estes.

var command = {
    action: null,
    direction: null,
    message: null,
};

module.exports = {
    /**
     * @param {Object} gameState
     * @return {Object} command
     */
    takeAction: function(gameState) {
        // *********************************************************************
        // CODE HERE!
        // *********************************************************************
        

        if (gameState == null) { // if game not started
            console.log("Starting game for bot 5");
            command.action = 'look';
            command.direction = 'none';
            return command;
        }

        // Shorthand:
        let moveCount = gameState.score.moveCount;
        let sight = gameState.engram.sight;
        let sound = gameState.engram.sound;
        let smell = gameState.engram.smell;
        let touch = gameState.engram.touch;
        let location = gameState.location;

        // Take inventory of senses:
        
        console.log('Move #' + moveCount + ', ' + location);
        console.log('Sight: ' + sight);
        console.log('Sound: ' + sound);
        console.log('Smell: ' + smell);
        console.log('Touch: ' + touch);
        
    if (sight.includes('sitting')) {
        command.action = 'stand';
        command.direction = 'none';
        return command;
    }
        if (sight.includes('exits')) {
            if (sight.includes('south')) {
                command.action = 'move';
                command.direction = 'south';
                return command;
            }
            if (sight.includes('east')) {
                command.action = 'move';
                command.direction = 'east';
                return command;
            }
            if (sight.includes('west')) {
                command.action = 'move';
                command.direction = 'west';
                return command;
            }
            if (sight.includes('north')) {
                command.action = 'move';
                command.direction = 'north';
                return command;
            }
        }

       

        // default command
        return command;

        // *********************************************************************
        // STOP CODING!
        // *********************************************************************
    },
};
