'use strict';

/*
 * Bot 1 - Chris Koehler
 */

const TRAP_UNKNOWN = -1;
const TRAP_SAFE = 0;
const TRAP_HERE = 1;
const TRAP_NEAR = 2;

const OBSERVED_NO = 0;
const OBSERVED_ADJACENT = 1;
const OBSERVED_LOOKED = 2;
const OBSERVED_VISITED = 3;

const RATING_IMPOSSIBLE = -1.0;
const RATING_WORST = 0.0;
const RATING_BAD = 0.25;
const RATING_NEUTRAL = 0.5;
const RATING_GOOD = 0.75;
const RATING_BEST = 1.0;
const RATING_MUST = 1.1;

const CONF_WORST = 0.0;
const CONF_BAD = 0.25;
const CONF_NEUTRAL = 0.5;
const CONF_GOOD = 0.75;
const CONF_BEST = 1.0;

const WALL_UNKNOWN = -1;
const WALL_PRESENT = 0;
const WALL_ABSENT = 1;

const DIRECTIONS = ['north', 'south', 'east', 'west'];
const ALL_DIRECTIONS = ['north', 'south', 'east', 'west', 'none'];

const PATTERN_WALLS = /exits to the\W*(north)?(?:\W|and)*(south)?(?:\W|and)*(east)?(?:\W|and)*(west)?\./i;
const PATTERN_EXIT = /(?:the exit) to the (south|north|east|west)/i;
const PATTERN_LAVA_SIGHT = /lava.*(north|south|east|west)/i;
const PATTERN_LAVA_SOUND = /lava.*(north|south|east|west)/i;
const PATTERN_LAVA_SMELL = /molten rock.*(north|south|east|west)/i;
const PATTERN_LAVA_TOUCH = /threatening warmth.*(north|south|east|west)/i;
const PATTERN_WON = /safely exit the maze/i;
const PATTERN_FIRE = /rythmic.*(north|south|east|west)/i;

// 2D array of cells
var maze = null;

var mazeWidth = 0;
var mazeHeight = 0;

var playerX = 0;
var playerY = 0;
var playerDir = null;
var playerState = null;
var playerMoved = false;

var exitDoorDir = null;

var moveNumber = 0;
var mostMovesInCell = 0;

function isInBounds(x, y) {
    return x >= 0 && x < mazeWidth && y >= 0 && y < mazeHeight;
}

function getOffsetX(dir) {
    /*
    if (dir == 'north') {
        return 0;
    }
    if (dir == 'south') {
        return 0;
    }
    */
    if (dir == 'east') {
        return 1;
    }
    if (dir == 'west') {
        return -1;
    }

    return 0;
}

function getOffsetY(dir) {
    if (dir == 'north') {
        return -1;
    }
    if (dir == 'south') {
        return 1;
    }

    return 0;
}

function getCellByDir(x, y, dir) {
    var nX = x + getOffsetX(dir);
    var nY = y + getOffsetY(dir);

    if (isInBounds(nX, nY)) {
        return maze[nX][nY];
    } else {
        return null;
    }
}

function invertDir(dir) {
    if (dir == 'north') {
        return 'south';
    }
    if (dir == 'south') {
        return 'north';
    }
    if (dir == 'east') {
        return 'west';
    }
    if (dir == 'west') {
        return 'east';
    }
    return null;
}

function addWall(x, y, dir) {
    var cell = maze[x][y];
    cell.walls[dir] = WALL_PRESENT;

    var neighbor = getCellByDir(x, y, dir);
    if (neighbor != null) {
        neighbor.walls[invertDir(dir)] = WALL_PRESENT;
    }
}

function removeWall(x, y, dir) {
    var cell = maze[x][y];
    cell.walls[dir] = WALL_ABSENT;

    var neighbor = getCellByDir(x, y, dir);
    if (neighbor != null) {
        neighbor.walls[invertDir(dir)] = WALL_ABSENT;
    }
}

function canMoveInDir(x, y, dir) {
    var cell = maze[x][y];
    
    // check for walls
    if (cell.walls[dir] != WALL_ABSENT) {
        return false;
    }

    // check bounds
    return getCellByDir(x, y, dir) != null;
}

function safeToMoveInDir(x, y, dir) {
    if (canMoveInDir(x, y, dir)) {
        var next = getCellByDir(x, y, dir);
        if (next.lava == TRAP_HERE) {
            return false;
        }
        if (next.pit == TRAP_HERE) {
            return false;
        }
        if (next.fire == TRAP_HERE) {
            return false;
        }
        return true;
    }
    return false;
}

function createZeroRating() {
    return {
        rating: RATING_IMPOSSIBLE,
        confidence: CONF_BEST,
    };
}


/*
 * Rating and confidence calculationas
 */
 
 // lava
function calcSpecificTrapRate(trap) {
    switch (trap) {
        case TRAP_HERE:
            return RATING_WORST;
        case TRAP_SAFE:
            return RATING_BEST;
        default:
            return RATING_NEUTRAL;
    }
}
function calcSpecificTrapConf(trap) {
    switch (trap) {
        case TRAP_UNKNOWN:
            return CONF_WORST;
        case TRAP_NEAR:
            return CONF_GOOD;
        default:
            return CONF_BEST;
    }
}

// pits
function calcPitRate(pit) {
    if (pit == TRAP_UNKNOWN) {
        return RATING_NEUTRAL;
    }
    if (pit == TRAP_HERE) {
        return RATING_WORST;
    }
    if (pit == TRAP_SAFE) {
        return RATING_BEST;
    }

    // TRAP_NEAR
    return RATING_BAD;
}
function calcPitConf(pit) {
    if (pit == TRAP_UNKNOWN) {
        return CONF_WORST;
    }
    if (pit == TRAP_NEAR) {
        return CONF_GOOD;
    }

    return CONF_BEST;
}

// visited
function calcVisitedRate(visited) {
    if (visited == OBSERVED_VISITED) {
        return RATING_WORST;
    }
    if (visited == OBSERVED_LOOKED) {
        return RATING_NEUTRAL;
    }
    return RATING_BEST;
}
function calcVisitedConf(visited) {
    return CONF_BEST;
}

// walls
function rateWall(wall) {
    if (wall == WALL_PRESENT) {
        return -0.25;
    }
    if (wall == WALL_ABSENT) {
        return 0.25;
    }
    return 0.0;
}
function calcWallsRate(walls) {
    var rate = RATING_NEUTRAL;
    rate += rateWall(walls.north);
    rate += rateWall(walls.south);
    rate += rateWall(walls.east);
    rate += rateWall(walls.west);
    
    return rate;
}
function calcWallsConf(walls) {
    var conf = CONF_WORST;
    if (walls.north != WALL_UNKNOWN) {
        conf += 0.25;
    }
    if (walls.south != WALL_UNKNOWN) {
        conf += 0.25;
    }
    if (walls.east != WALL_UNKNOWN) {
        conf += 0.25;
    }
    if (walls.west != WALL_UNKNOWN) {
        conf += 0.25;
    }
    
    return conf;
}

function calcContinueRate(cell) {
    var next = getCellByDir(playerX, playerY, playerDir);
    if (next == cell) {
        return RATING_BEST;
    } else {
        return RATING_WORST;
    }
}

function calcContinueConf(cell) {
    return CONF_BEST;
}

function calcVisitCountRate(cell) {
    if (mostMovesInCell != 0) {
        return (mostMovesInCell - cell.visitCount) / mostMovesInCell;
    } else {
        return RATING_BEST;
    }
}

function calcVisitCountConf(cell) {
    return CONF_BEST;
}

function calcTrapRate(cell) {
    var rate = 0.0;
    
    rate += 0.33 * calcSpecificTrapRate(cell.lava);
    rate += 0.33 * calcSpecificTrapRate(cell.fire);
    rate += 0.33 * calcSpecificTrapRate(cell.pit);

    return rate;
}

function calcTrapConf(cell) {
    var conf = 0.0;
    
    conf += 0.33 * calcSpecificTrapConf(cell.lava);
    conf += 0.33 * calcSpecificTrapConf(cell.fire);
    conf += 0.33 * calcSpecificTrapConf(cell.pit);

    return conf;
}

function getCellRating(cell) {
    var confidence = 0.0;
    var rating = 0.0;

    // value += weight * normalized value


    rating += 0.05 * calcContinueRate(cell);
    confidence += 0.05 * calcContinueConf(cell);

    rating += 0.25 * calcVisitCountRate(cell);
    confidence += 0.25 * calcVisitCountConf(cell);

    //rating += 0.3 * calcLavaRate(cell.lava);
    //confidence += 0.3 * calcLavaConf(cell.lava);
    rating += 0.3 * calcTrapRate(cell);
    confidence += 0.3 * calcTrapConf(cell);

    //rating += 0.25 * calcPitRate(cell.pit);
    //confidence += 0.25 * calcPitConf(cell.pit);

    rating += 0.4 * calcVisitedRate(cell.observed);
    confidence += 0.4 * calcVisitedConf(cell.observed);

    //rating += 0.1 * calcWallsRate(cell.walls);
    //confidence += 0.1 * calcWallsConf(cell.walls);

    return {
        confidence: confidence,
        rating: rating,
    };
}

function getCellRatingByCoord(x, y) {
    if (isInBounds(x, y)) {
        return getCellRating(maze[x][y]);
    } else {
        return createZeroRating();
    }
}

function getCellRatingByDir(x, y, dir) {
    var cell = getCellByDir(x, y, dir);
    if (cell != null) {
        return getCellRating(cell);
    } else {
        return createZeroRating();
    }
}

function calcLookRating(dir) {
    if (maze[playerX][playerY].walls[dir] != WALL_PRESENT) {
        var cell = getCellByDir(playerX, playerY, dir);
        if (cell != null) {
            switch (cell.observed) {
                case OBSERVED_VISITED:
                case OBSERVED_LOOKED:
                    return RATING_WORST;
                case OBSERVED_ADJACENT:
                    return RATING_NEUTRAL;
                case OBSERVED_NO:
                    return RATING_BEST;
                default:
                    console.log("[Brain] [WARN] cell is in invalid observed state: " + cell.observed);
                    return RATING_NEUTRAL;
            }
        } else {
            return RATING_IMPOSSIBLE;
        }
    } else {
        return RATING_IMPOSSIBLE;
    }
}

function calcLookConf(dir) {
    return CONF_BEST;
}

function calcStandRating() {
    if (playerState != 'standing') {
        return RATING_BEST;
    } else {
        return RATING_IMPOSSIBLE;
    }
}

function calcStandConf() {
    return CONF_BEST;
}

function calcMoveRating(dir) {
    if (safeToMoveInDir(playerX, playerY, dir)) {
        return getCellRatingByDir(playerX, playerY, dir).rating;
    } else {
        return RATING_IMPOSSIBLE;
    }
}

function calcMoveConf(dir) {
    if (safeToMoveInDir(playerX, playerY, dir)) {
        return getCellRatingByDir(playerX, playerY, dir).confidence;
    } else {
        return CONF_BEST;
    }
}


/*
 * Parsing functions
 */
function initMaze(gameState) {
    var mazeDims = gameState.mazeId.split(":");
    var mazeX = parseInt(mazeDims[0]);
    var mazeY = parseInt(mazeDims[1]);
    
    mazeWidth = mazeY;
    mazeHeight = mazeX;
    
    maze = new Array(mazeWidth);
    for (var x = 0; x < mazeWidth; x++) {
        maze[x] = new Array(mazeHeight);
        for (var y = 0; y < mazeHeight; y++) {
            maze[x][y] = {
                x: x,
                y: y,

                observed: OBSERVED_NO,
                visitCount: 0,

                lava: TRAP_UNKNOWN,
                pit: TRAP_UNKNOWN,
                fire: TRAP_UNKNOWN,
                exit: TRAP_UNKNOWN,
                start: TRAP_UNKNOWN,
                
                walls: {
                    north: WALL_UNKNOWN,
                    east: WALL_UNKNOWN,
                    south: WALL_UNKNOWN,
                    west: WALL_UNKNOWN,
                },
            };
        }
    }
}

// update player location
function updateLocation(location) {
    var oldX = playerX;
    var oldY = playerY;

    playerX = location.col;
    playerY = location.row;

    if (playerX != oldX || playerY != oldY) {
        console.log("[Engram] Moved to " + playerX + "," + playerY);

        playerMoved = true;
    } else {
        playerMoved = false;
    }
}

// updates walls by sight
function updateWalls(sight, x, y) {
    // match the regex
    var matches = PATTERN_WALLS.exec(sight);
    
    // find all the doors
    if (matches != null) {
        // loop through each match, starting at first group
        for (var i = 1; i < matches.length; i++) {
            // make sure match existed
            if (matches[i]) {
                var match = matches[i].toLowerCase();
                switch (match) {
                    case "north":
                        removeWall(x, y, 'north');
                        break;
                    case "east":
                        removeWall(x, y, 'east');
                        break;
                    case "south":
                        removeWall(x, y, 'south');
                        break;
                    case "west":
                        removeWall(x, y, 'west');
                        break;
                    default:
                        console.log("Bad wall: '" + match + "' from '" + sight + "'.");
                        break;
                }
            }
        }
    } else {
        console.log("[Engram] [WARN] walls pattern did not match.");
    }
    
    // add remaining spaces as walls
    if (maze[x][y].walls['north'] == WALL_UNKNOWN) {
        addWall(x, y, 'north');
    }
    if (maze[x][y].walls['south'] == WALL_UNKNOWN) {
        addWall(x, y, 'south');
    }
    if (maze[x][y].walls['east'] == WALL_UNKNOWN) {
        addWall(x, y, 'east');
    }
    if (maze[x][y].walls['west'] == WALL_UNKNOWN) {
        addWall(x, y, 'west');
    }
}

function updateExit(engram) {
    // match the regex
    var matches = PATTERN_EXIT.exec(engram.sound);

    // set to null, if exit is found then it will be reset below
    exitDoorDir = null;

    if (matches != null) {
        if (matches.length == 2) {
            if (matches[1]) {
                // set the exit
                exitDoorDir = matches[1];

                console.log("[Engram] Found exit: " + exitDoorDir);
            } else {
                console.log("[Engram] [WARN] Exit regex matched but did not have an exit!");
            }
        } else {
            console.log("[Engram] [WARN] Exit regex matched but had wrong number of groups!");
        }
    }
}

function observeCell(x, y, visited) {
    if (isInBounds(x, y)) {
        maze[x][y].observed = visited ? OBSERVED_VISITED : OBSERVED_LOOKED;

        // update neighbors
        DIRECTIONS.forEach(function(dir) {
            if (maze[x][y].walls[dir] == WALL_ABSENT) {
                var cell = getCellByDir(x, y, dir);
                if (cell != null && cell.observed == OBSERVED_NO) {
                    cell.observed = OBSERVED_ADJACENT;
                }
            }
        });
    } else {
        console.log("[Engram] [WARN] Tried to observe out of bounds!");
    }
}

function lookForTraps(x, y, engram) {
    if (isInBounds(x, y)) {
        var fireMatched = [];
        var lavaMatched = [];
        var pitMatched = [];

        // Check for lava
        [PATTERN_LAVA_SIGHT, PATTERN_LAVA_SMELL, PATTERN_LAVA_SOUND, PATTERN_LAVA_TOUCH].forEach(function(pattern) {
            // match the regex
            // TODO fix for non-sound
            var matches = pattern.exec(engram.sound);

            if (matches != null) {
                if (matches.length == 2 && matches[1]) {
                    var dir = matches[1];
                    lavaMatched.push(dir);

                    // add the cell that the lava is in
                    var cell = getCellByDir(x, y, dir);
                    if (cell != null) {
                        cell.lava = TRAP_HERE;
                    } else {
                        console.log("[Engram] [WARN] Found trap out of bounds: " + x + "," + y + "->" + dir);
                    }

                    // TODO update neighbors
                } else {
                    console.log("[Engram] [WARN] Pattern matched but had wrong number of groups: " + pattern);
                }
            }
        });

        var fireMatched = [];

        // Check for fire
        var matches = PATTERN_FIRE.exec(engram.sound);

        if (matches != null) {
            if (matches.length == 2 && matches[1]) {
                var dir = matches[1];
                fireMatched.push(dir);

                // add the cell that the fire is in
                var cell = getCellByDir(x, y, dir);
                if (cell != null) {
                    cell.fire = TRAP_HERE;
                } else {
                    console.log("[Engram] [WARN] Found trap out of bounds: " + x + "," + y + "->" + dir);
                }

                // TODO update neighbors
            } else {
                console.log("[Engram] [WARN] Pattern matched but had wrong number of groups: " + pattern);
            }
        }

        DIRECTIONS.forEach(function(dir) {
            // mark cell as safe
            var cell = getCellByDir(x, y, dir);
            if (cell != null) {
                if (!lavaMatched.includes(dir)) {
                    cell.lava = TRAP_SAFE;
                }
                if (!fireMatched.includes(dir)) {
                    cell.fire = TRAP_SAFE;
                }
                if (!pitMatched.includes(dir)) {
                    cell.pit = TRAP_SAFE;
                }
            }
        });
    } else {
        console.log("[Engram] [WARN] Can't look for traps - out of bounds");
    }
}

// Parses an engram and updates the maze data
function parseEngram(gameState) {
    // update direction
    if (gameState.direction.toLowerCase() != playerDir) {
        playerDir = gameState.direction.toLowerCase();

        console.log("[Engram] Turned to " + playerDir);
    }

    // Get location where action took place
    var actionX = playerX;
    var actionY = playerY;
    
    // if we were LOOKing
    if (gameState.action == "LOOK") {
        // then switch coordinates to the target block
        actionX += getOffsetX(playerDir);
        actionY += getOffsetY(playerDir);

        console.log("[Engram] We looked at " + actionX + "," + actionY);
    }
    
    // update walls
    if (isInBounds(actionX, actionY)) {
        updateWalls(gameState.engram.sight, actionX, actionY);
    } else {
        console.log("[Engram] [WARN] can't update walls - out of bounds: " + actionX + "," + actionY);
    }

    // Update square visited state (must be after walls)
    if (playerMoved || gameState.action == "LOOK") {
        observeCell(actionX, actionY, true);
    }

    // Update square enter count
    if (playerMoved) {
        // Find the cell
        var cell = maze[actionX][actionY];

        // Increase its visit count
        cell.visitCount++;

        // If this is the most visited then remember
        if (cell.visitCount > mostMovesInCell) {
            mostMovesInCell = cell.visitCount;
        }

    }

    // Look for traps
    lookForTraps(actionX, actionY, gameState.engram);

    // update condition
    if (gameState.playerStateInWords != playerState) {
        playerState = gameState.playerStateInWords;

        console.log("[Engram] Player is now " + playerState);
    }

    // Update exit
    updateExit(gameState.engram);
}

/*
 * Action code
 */
function createLookAction(direction) {
    return {
        command: {
            action: 'look',
            direction: direction,
        },
        rating: calcLookRating(direction),
        conf: calcLookConf(direction),
    };
}

function createStandAction() {
    return {
        command: {
            action: 'stand',
            direction: 'up',
        },
        rating: calcStandRating(),
        conf: calcStandConf(),
    };
}

function createDirectionAction(dir) {
    return {
        command: {
            action: 'move',
            direction: dir,
        },
        rating: calcMoveRating(dir),
        conf: calcMoveConf(dir),
    };
}

function createExitAction() {
    if (exitDoorDir != null) {
        return {
            command: {
                action: 'move',
                direction: exitDoorDir,
            },
            rating: RATING_MUST,
            conf: CONF_BEST,
        };
    } else {
        return {
            command: {},
            rating: RATING_IMPOSSIBLE,
            conf: CONF_BEST,
        };
    }
}

function findPossibleActions() {
    var actions = [];

    // Add look actions
    ALL_DIRECTIONS.forEach(function(dir) {
        actions.push(createLookAction(dir));
    });

    // Add stand action
    actions.push(createStandAction());
    
    // Add direction actions
    DIRECTIONS.forEach(function(dir) {
        actions.push(createDirectionAction(dir));
        // TODO jump action
    });

    // Add exit action
    actions.push(createExitAction());

    console.log("Possible actions:");
    //console.log(JSON.stringify(actions, null, 2));
    console.log(JSON.stringify(actions));

    return actions;
}

function pickAction(actions) {
    if (actions.length > 0) {
        // number of actions to consider
        var numToConsider = Math.max(1, Math.round(0.33 * actions.length));

        var filteredActions = [];

        // Filter actions
        actions.forEach(function(action) {
            if (action.conf >= CONF_GOOD || action.rating >= RATING_GOOD || filteredActions.length < numToConsider) {
                filteredActions.push(action);
            }
        });

        // Sort by combined value
        filteredActions.sort(function(a, b) {
            return (b.conf * b.rating) - (a.conf * a.rating);
        });

        // Trim to size (probably not needed)
        while (filteredActions.length > numToConsider) {
            filteredActions.pop();
        }

        return filteredActions[0];
        /*
        // sort by confidence
        actions.sort(function(a, b) {
            return b.conf - a.conf;
        });

        //console.log("Sorted actions:");
        //console.log(JSON.stringify(actions));

        // Minimum number of low-priority actions to consider
        var lowToConsider = Math.max(1, Math.floor(0.25 * actions.length));

        var filteredActions = [];

        // pick out most confidend
        var lowConsidered = 0;

        actions.forEach(function(action) {
            // High confidence has priority
            if (action.conf >= CONF_GOOD) {
                filteredActions.push(action);
            } else if (lowConsidered < lowToConsider) {
                filteredActions.push(action);
                lowConsidered++;
            }
        });

        //for (var i = 0; i < numToConsider; i++) {
        //    filteredActions[i] = actions[i];
        //}

        // sort by rating
        filteredActions.sort(function(a, b) {
            return b.rating - a.rating;
        });

        //console.log("Filtered actions:");
        //console.log(JSON.stringify(actions));

        // return best rated
        return filteredActions[0];
        */
    } else {
        console.log("[Brain] There are no possible actions!");
        return null;
    }
}

function makeAction(action) {
    return action.command;
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

        var command = {
            action: null,
            direction: null,
            message: "not doing nothing",
        };

        // If we are just starting the maze, then look
        if (null == gameState) {
            console.log("Making first look");
            
            command.action = "look";
            command.direction = "none";
            command.message = "first look";
            return command;
        } else {
            // update move number
            moveNumber = gameState.score.moveCount + 1;

            // print game state
            //console.log(JSON.stringify(gameState, null, 2));
            console.log("[Game] Begining move " + moveNumber);
            console.log("[Game] Sight: " + gameState.engram.sight.trim());
            console.log("[Game] Sound: " + gameState.engram.sound.trim());
            console.log("[Game] Smell: " + gameState.engram.smell.trim());
            console.log("[Game] Touch: " + gameState.engram.touch.trim());
            console.log("[Game] Taste: " + gameState.engram.taste.trim());

            // Check for victory
            if (PATTERN_WON.test(gameState.engram.touch)) {
                console.log("We won!");

                maze = null;
                mazeWidth = 0;
                mazeHeight = 0;

                playerX = 0;
                playerY = 0;
                playerDir = null;
                playerState = null;
                playerMoved = false;

                exitDoorDir = null;

                moveNumber = 0;
                mostMovesInCell = 0;

                console.log("Making look action for next game");
                command.action = "look";
                command.direction = "none";
                command.message = "first look";
                return command;
            }

            // if this is first action, then build maze
            if (maze == null) {
                console.log("Initializing maze");
                
                initMaze(gameState);
            }
            
            /*
            Parse engram
            */

            console.log("Updating game model");
            
            // update bot location
            updateLocation(gameState.location);
            
            // parse the engram and update maze
            parseEngram(gameState);
            
            /*
            Pick action
            */
           console.log("[Brain] Picking action");
           var actions = findPossibleActions();
           var action = pickAction(actions);
            
           /*
            Making action
           */
          console.log("[Action] Making action");
          command = makeAction(action);

          console.log("[Action] Made action: " + JSON.stringify(command));

          return command;
        }
        
        // always return the command
        console.log("We fell to the bottom!");
        return command;

        // *********************************************************************
        // STOP CODING!
        // *********************************************************************
    },
};
