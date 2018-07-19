'use strict';

/*
 * Bot 1 - Chris Koehler
 */

const MAX_DIST = 3;
const DIST_UNKNOWN = -2;
const DIST_SAFE = -1;
const DIST_HERE = 0;

const OBSERVED_NO = 0;
const OBSERVED_LOOKED = 1;
const OBSERVED_VISITED = 2;

const RATING_IMPOSSIBLE = -1.0;
const RATING_WORST = 0.0;
const RATING_BAD = 0.25;
const RATING_NEUTRAL = 0.5;
const RATING_GOOD = 0.75;
const RATING_BEST = 1.0;

const CONF_WORST = 0.0;
const CONF_BAD = 0.25;
const CONF_NEUTRAL = 0.5;
const CONF_GOOD = 0.75;
const CONF_BEST = 1.0;

const WALL_UNKNOWN = -1;
const WALL_PRESENT = 0;
const WALL_ABSENT = 1;

const PATTERN_WALLS = /exits to the\\W*(north)?(?:\\W|and)*(south)?(?:\\W|and)*(east)?(?:\\W|and)*(west)?\\./;

// 2D array of cells
var maze = null;

var mazeWidth = 0;
var mazeHeight = 0;

var playerX = 0;
var playerY = 0;
var playerDir = null;

/*
var maze = new Array(10);
for (var x = 0; x < maze.length; x++) {
    maze[x] = new Array(10);
    for (var y = 0; y < maze[x].length; y++) {
        maze[x][y] = {
            x: x,
            y: y,

            observed: OBSERVED_NO,

            fire: DIST_UNKNOWN,
            pit: DIST_UNKNOWN,
            exit: DIST_UNKNOWN,
            start: DIST_UNKNOWN,
            
            walls: {
                north: WALL_UKNOWN,
                east: WALL_UKNOWN,
                south: WALL_UKNOWN,
                west: WALL_UKNOWN
            }
        };
    }
}
*/

/*
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
*/

/*
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
*/

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

function isInBounds(x, y) {
    return x >= 0 && x < 10 && y >= 0 && y < 10;
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
    if (cell.walls[dir] != WALL_PRESENT) {
        return false;
    }

    // check bounds
    return getCellByDir(x, y, dir) != null;
}

function shouldMoveInDir(x, y, dir) {
    if (canMoveInDir(x, y, dir)) {
        var next = getCellByDir(x, y, dir);
        if (next.fire == DIST_HERE) {
            return false;
        }
        if (next.pit == DIST_HERE) {
            return false;
        }
    }
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
 
 // fire
function calcFireRate(fire) {
    if (fire == DIST_UNKNOWN) {
        return RATING_NEUTRAL;
    }
    if (fire == DIST_HERE) {
        return RATING_WORST;
    }
    if (fire == DIST_SAFE) {
        return RATING_BEST;
    }
    return Math.min(RATING_GOOD, (fire / (MAX_DIST + 1)) * RATING_GOOD);
}
function calcFireConf(fire) {
    if (fire == DIST_UNKNOWN) {
        return CONF_WORST;
    }
    if (fire == DIST_HERE) {
        return CONF_BEST;
    }
    if (fire == DIST_SAFE) {
        return CONF_BEST;
    }
    return Math.min(CONF_GOOD, (fire / (MAX_DIST + 1)) * CONF_GOOD);
}

// pits
function calcPitRate(pit) {
    if (pit == DIST_UNKNOWN) {
        return RATING_NEUTRAL;
    }
    if (pit == DIST_HERE) {
        return RATING_WORST;
    }
    if (pit == DIST_SAFE) {
        return RATING_BEST;
    }
    return Math.min(RATING_GOOD, (pit / (MAX_DIST + 1)) * RATING_GOOD);
}
function calcPitConf(pit) {
    if (pit == DIST_UNKNOWN) {
        return CONF_WORST;
    }
    if (pit == DIST_HERE) {
        return CONF_BEST;
    }
    if (pit == DIST_SAFE) {
        return CONF_BEST;
    }
    return Math.min(CONF_GOOD, (pit / (MAX_DIST + 1)) * CONF_GOOD);
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

/*
 * Cell rating functions
 */
function getCellRating(cell) {
    var confidence = 0.0;
    var rating = 0.0;

    // value += weight * normalized value

    rating += 0.2 * calcFireRate(cell.fire);
    confidence += 0.2 * calcFireConf(cell.fire);

    rating += 0.2 * calcPitRate(cell.pit);
    confidence += 0.2 * calcPitConf(cell.fire);

    rating += 0.5 * calcVisitedRate(cell.visited);
    confidence += 0.5 * calcVisitedConf(cell.visited);

    rating += 0.1 * calcWallsRate(cell.walls);
    confidence += 0.1 * calcWallsConf(cell.walls);

    return {
        confidence: confidence,
        rating: rating,
    };
}

function getCellRating(x, y) {
    if (isInBounds(x, y)) {
        return getCellRating(maze[x][y]);
    } else {
        return createZeroRating();
    }
}

function getCellRating(x, y, dir) {
    var cell = getCellByDir(x, y, dir);
    if (cell != null) {
        return createZeroRating();
    }
}

/*
 * Parsing functions
 */
function initMaze(gameState) {
    var mazeDims = gameState.mazeId.split(":");
    var mazeX = parseInt(mazeDims[0]);
    var mazeY = parseInt(mazeDims[1]);
    
    mazeWidth = mazeX;
    mazeHeight = mazeY;
    
    maze = new Array(mazeWidth);
    for (var x = 0; x < mazeWidth; x++) {
        maze[x] = new Array(mazeHeight);
        for (var y = 0; y < mazeHeight; y++) {
            maze[x][y] = {
                x: x,
                y: y,

                observed: OBSERVED_NO,

                fire: DIST_UNKNOWN,
                pit: DIST_UNKNOWN,
                exit: DIST_UNKNOWN,
                start: DIST_UNKNOWN,
                
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
    playerX = location.row;
    playerY = location.col;
}

// updates walls by sight
function updateWalls(sight, x, y) {
    // match the regex
    var matches = PATTERN_WALLS.exec(sight);
    
    // loop through each match, starting at first group
    for (var i = 1; i < matches.length; i++) {
        var match = matches[i].toLowerCase();
        switch (match) {
            case "north":
                addWall(x, y, 'north');
                break;
            case "east":
                addWall(x, y, 'east');
                break;
            case "south":
                addWall(x, y, 'south');
                break;
            case "west":
                addWall(x, y, 'west');
                break;
            default:
                console.log("Bad wall: '" + match + "' from '" + sight + "'.");
                break;
        }
    }
    
    // set remaining walls to open
    if (maze[x][y].walls['north'] == WALL_UNKNOWN) {
        removeWall(x, y, 'north');
    }
    if (maze[x][y].walls['south'] == WALL_UNKNOWN) {
        removeWall(x, y, 'south');
    }
    if (maze[x][y].walls['east'] == WALL_UNKNOWN) {
        removeWall(x, y, 'east');
    }
    if (maze[x][y].walls['west'] == WALL_UNKNOWN) {
        removeWall(x, y, 'west');
    }
}

// Parses an engram and updates the maze data
function parseEngram(engram) {
    var x = playerX;
    var y = playerY;
    
    // update direction
    if (engram.direction.toLowerCase() != playerDir) {
        console.log("Turning to " + engram.direction);
        
        playerDir = engram.direction.toLowerCase();
    }
    
    // if we were LOOKing
    if (engram.action == "LOOK") {
        // then switch coordinates to the target block
        x += getOffsetX(playerDir);
        y += getOffsetY(playerDir);
    }
    
    // update walls
    if (isInBounds(x, y)) {
        updateWalls(engram.sight, x, y);
    } else {
        console.log("Looked out of bounds: " + x + "," + y);
    }
    
    // update location and position
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
        } else {
            // if this is first action, then build maze
            if (maze == null) {
                console.log("Initializing maze");
                
                initMaze(gameState);
            }
            
            console.log("Updating game model");
            
            // update bot location
            updateLocation(gameState.location);
            
            // parse the engram and update maze
            parseEngram(gameState.engram); 
            
            
            
        /*
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
                    if (!lookedRight) {
                        lookedRight = true;
                        command.action = "look";
                        command.direction = getRight(imFacing);
                    } else if (!lookedLeft) {
                        lookedLeft = true;
                        command.action = "look";
                        command.direction = getLeft(imFacing);
                    } else {
                        command.action = "move"; // turn around!
                        command.direction = getRight(getRight(imFacing));
                        imFacing = command.direction;
                    }
                }
                */
            }
        
        // always return the command
        return command;

        // *********************************************************************
        // STOP CODING!
        // *********************************************************************
    },
};
