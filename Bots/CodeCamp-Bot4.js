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

        command.action="look";
        command.direction="east";

        return command;

        // *********************************************************************
        // STOP CODING!
        // *********************************************************************
    },
};
