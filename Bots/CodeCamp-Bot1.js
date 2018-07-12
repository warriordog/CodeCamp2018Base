'use strict';

var command = {
    action: null,
    direction: null,
};

module.exports = {
    /**
     * @param {Object} engram
     * @return {Object} command
     */
    takeAction: function(engram) {
        // *********************************************************************
        // CODE HERE!
        // *********************************************************************

        if (null == engram) {
            command.action='look';
            command.direction='north';
        } else if (command.action == "move") {
            command.action = "look";
        } else { // we just looked at something
            if (!engram.sight.toLowerCase().includes('lava') &&
                !engram.sight.toLowerCase().includes('wall')) {
                command.action = "move";
            } else {
                switch (command.direction) { // go in circles!
                    case "north": {
                        command.direction = "east";
                        break;
                    }
                    case "east": {
                        command.direction = "south";
                        break;
                    }
                    case "south": {
                        command.direction = "west";
                        break;
                    }
                    case "west": {
                        command.direction = "north";
                        break;
                    }
                }
            }
        }

        return command;

        // *********************************************************************
        // STOP CODING!
        // *********************************************************************
    },
};
