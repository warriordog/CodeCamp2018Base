'use strict';

// Chris Koeher - Right hand rule bot

const SENSES = ['sight', 'sound', 'smell', 'touch', 'taste'];

const PATTERNS = {
    fire: {
        sound: /rhythmically clicking and hissing.*(north|south|east|west)/i,
    },
    lava: {
        sight: /lava.*(north|south|east|west)/i,
        sound: /lava.*(north|south|east|west)/i,
        smell: /molten rock.*(north|south|east|west)/i,
        touch: /threatening warmth.*(north|south|east|west)/i,
    },
    pit: {
        sound: /echoing wind.*(north|south|east|west)/i,
        touch: /cool, wet breeze.*(north|south|east|west)/i,
    },
    exit: {
        sound: /(?:the exit) to the (south|north|east|west)/i,
    },
    doors: {
        sight: /exits to the\W*(north)?(?:\W|and)*(south)?(?:\W|and)*(east)?(?:\W|and)*(west)?\./i,
    },
};

const FLIPS = {
    north: 'south',
    east: 'west',
    south: 'north',
    west: 'east',
};

const TURNS = {
    north: ['east', 'north', 'west', 'south'],
    east: ['south', 'east', 'north', 'west'],
    south: ['west', 'south', 'east', 'north'],
    west: ['north', 'west', 'south', 'east'],
};

var playerDir = "south";

function matchPattern(gameState, type) {
    var directions = [];

    SENSES.forEach((sense) => {
        if (PATTERNS[type][sense]) {
            var pattern = PATTERNS[type][sense];
            
            var matches = pattern.exec(gameState.engram[sense]);

            if (matches != null && matches.length > 1) {
                for (var i = 1; i < matches.length; i++) {
                    if (matches[i]) {
                        directions.push(matches[i]);
                    }
                }
            }
        }
    });

    return directions;
}

function goRight(gameState, paths) {
    for (var dir of TURNS[playerDir]) {
    //TURNS[playerDir].forEach(function(dir) {
        if (paths.includes(dir)) {
            return dir;
        }
    }

    console.log("Can't turn right!");
    return null;
}

function turnAround(gameState) {
    return FLIPS[playerDir];
}

function findDoors(gameState) {
    return matchPattern(gameState, 'doors');
}

function findTraps(gameState) {
    var fire = matchPattern(gameState, 'fire');
    var pits = matchPattern(gameState, 'pit');
    var lava = matchPattern(gameState, 'lava');

    return fire.concat(pits).concat(lava);
}

function findValidPaths(gameState) {
    var exits = findDoors(gameState);
    var traps = findTraps(gameState);

    var paths = [];
    exits.forEach((exit) => {
        if (!traps.includes(exit)) {
            paths.push(exit);
        }
    });

    return paths;
}

function findNextStep(gameState) {
    var paths = findValidPaths(gameState);

    if (paths.length > 0) {
        return goRight(gameState, paths);
    } else {
        return turnAround(gameState);
    }
}

function findExit(gameState) {
    var exits = matchPattern(gameState, 'exit');
    
    if (exits.length > 0) {
        return exits[0];
    } else {
        return null;
    }
}

function pickDirection(gameState) {
    var dir = findExit(gameState);
    
    if (dir == null) {
        dir = findNextStep(gameState);
    }

    return dir;
}

module.exports = {
    /**
     * @param {Object} gameState
     * @return {Object} command
     */
    takeAction: function(gameState) {
        var command = {
            action: null,
            direction: null,
            message: null,
        };

        if (gameState == null) {
            console.log("Making first look");

            command.action = "look";
            command.direction = "none";
            console.log("Looking: " + JSON.stringify(command));
            return command;
        } else {
            // stand up
            if (gameState.playerStateInWords.toLowerCase() == 'sitting') {
                command.action = "stand";
                command.direction = "up";
                console.log("Standing: " + JSON.stringify(command));
                return command;
            }

            if (gameState.action == "MOVE") {
                if (gameState.direction.toLowerCase() != "none") {
                    playerDir = gameState.direction.toLowerCase();
                    console.log("Turned to " + playerDir);
                } else {
                    playerDir = "south";
                    console.log("Can't turn to none, turning south instead.");
                }
            }

            var dir = pickDirection(gameState);

            command.action = "move";
            command.direction = dir;

            console.log("Moving: " + JSON.stringify(command));
            return command;
        }
        
        console.log("We didn't do anything!");
        command.action = "look";
        command.direction = "none";
        return command;
    },
};
