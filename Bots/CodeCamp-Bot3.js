'use strict';

var command = {
    action: null,
    direction: null,
};

var imFacing = "north";
var lookedRight = false;
var lookedLeft = false;

function openExit(direction, sight) {
    var exits = getExits(sight);

    if (direction == "north" && exits.north) {
        return true;
    }
    if (direction == "south" && exits.south) {
        return true;
    }
    if (direction == "east" && exits.east) {
        return true;
    }
    if (direction == "west" && exits.west) {
        return true;
    }

    return false;
}

function getExits(sight) {
    var exits = {
        north: false,
        south: false,
        east: false,
        west: false,
    };
    
    if (sight.includes("exit")) {
        if (sight.includes("north")) {
            exits.north=true;
        }
        if (sight.includes("south")) {
            exits.south=true;
        }
        if (sight.includes("east")) {
            exits.east=true;
        }
        if (sight.includes("west")) {
            exits.west=true;
        }
    }

    return exits;
}

function getRight(direction) {
    if ("north" == direction) {
        return "east";
    }
    if ("east" == direction) {
        return "south";
    }
    if ("south" == direction) {
        return "west";
    }
    if ("west" == direction) {
        return "north";
    }
    return "north"; // don't know!   
}

function getLeft(direction) {
    if ("north" == direction) {
        return "west";
    }
    if ("east" == direction) {
        return "north";
    }
    if ("south" == direction) {
        return "east";
    }
    if ("west" == direction) {
        return "south";
    }
    return "south"; // don't know!   
}

module.exports = {
    /**
     * @param {Object} gameState
     * @return {Object} command
     */
    takeAction: function(gameState) {
        // *********************************************************************
        // CODE HERE!
        // *********************************************************************

        if (null == gameState) {
            command.action='look';
            command.direction=imFacing;
        } else {
                // let's see what we saw
                if (!gameState.engram.sight.toLowerCase().includes('lava') &&
                    !gameState.engram.sight.toLowerCase().includes('wall')) {
                    // no lava, no wall, that's good!

                    if ("look" == command.action) {
                        // if our last action was looking in a direction, go ahead and move that way
                        imFacing = command.direction;
                        command.action = "move";
                        lookedLeft = false;
                        lookedRight = false;
                    } else {
                        // we're in motion, so use the sight sense to keep moving quickly
                        if (openExit(getRight(imFacing), gameState.engram.sight)) {
                            imFacing = getRight(imFacing);
                            command.action = "move";
                            command.direction = imFacing;
                        } else if (openExit(imFacing, gameState.engram.sight)) {
                            command.action = "move";
                            command.direction = imFacing;
                        } else if (openExit(getLeft(imFacing), gameState.engram.sight)) {
                            imFacing = getLeft(imFacing);
                            command.action = "move";
                            command.direction = imFacing;
                        } else {
                            imFacing = getRight(getRight(imFacing));
                            command.action = "move";
                            command.direction = imFacing;
                        }
                    }
                } else {
                    if (!lookedLeft) {
                        lookedLeft = true;
                        command.action = "look";
                        command.direction = getLeft(imFacing);
                    } else if (!lookedRight) {
                        lookedRight = true;
                        command.action = "look";
                        command.direction = getRight(imFacing);
                    } else {
                        command.action = "look"; // turn around!
                        command.direction = getRight(getRight(imFacing));
                        imFacing = command.direction;
                    }
                }
            }
        
        return command;

        // *********************************************************************
        // STOP CODING!
        // *********************************************************************
    },
};
