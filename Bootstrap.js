'use strict';

/*
 *
 * ==========================================================
 * WARNING -  WARNING - WARNING - WARNING - WARNING - WARNING
 * ==========================================================
 * 
 *               KIDS: DO NOT CHANGE THIS FILE
 
 * ==========================================================
 * WARNING -  WARNING - WARNING - WARNING - WARNING - WARNING
 * ==========================================================
 * 
 */ 

delete require.cache['Logger.js'];
delete require.cache['data/init.json'];

// load utilities
var LoggerJS = require('./Logger.js');
var UtilJS = require('util');
var BootstrapData = require('./data/data');

// configure the logger
var logger = LoggerJS.Logger.getInstance(); // simple logging wrapper
logger.setLogLevel(LoggerJS.LOG_LEVELS["TRACE"]);
logger.trace(__filename, '', 'Logger initialized...');

// Load the required modules
logger.trace(__filename, '', 'Load "request" library...');
var req = require('request');

// Load the CodeCamp Bots (These are the files you'll be working in!)
logger.trace(__filename, '', 'Load Code Camp bots...');
var CodeCampBot1 = require('./Bots/CodeCamp-Bot1');
var CodeCampBot2 = require('./Bots/CodeCamp-Bot2');
var CodeCampBot3 = require('./Bots/CodeCamp-Bot3');
var CodeCampBot4 = require('./Bots/CodeCamp-Bot4');
var CodeCampBot5 = require('./Bots/CodeCamp-Bot5');
var CodeCampBot6 = require('./Bots/CodeCamp-Bot6');

// get rid of ESLint errors for now...
CodeCampBot2 = CodeCampBot3;
CodeCampBot3 = CodeCampBot2;
CodeCampBot4 = CodeCampBot5;
CodeCampBot5 = CodeCampBot4;
CodeCampBot2 = CodeCampBot6;

// BASIC FLOW
//   1. Find our Team ID from BootstrapData.teamName
//   2. Parse active games to see if we already have one so we can stop it
//   3. Examine the score history to find out which maze in BootstrapData.mazes we have not yet solved
//        - if we're given a specific maze, just use that one
//        - if we're told to start at the beginning, do so
//        - if we've beat them all, ABEND!
//   4. Create a game for the next maze we need to solve
//   5. Play the game, simple request/response cycle calling the bots
//   6. Once we solve the maze, go back to Step #3

// try to find this team
logger.trace(__filename, '', "Retrieving team list...");
makeRequest('http://game.code-camp-2018.com/teams', FindMyTeam);

function FindMyTeam(error, response, body) {
    logger.debug(__filename, 'FindMyTeam()', 'Entry Point');

    if (undefined != error) {
        logger.error(__filename, 'FindMyTeam()', UtilJS.format('Error retrieving list of teams: %s' + error));
        logger.debug(__filename, 'FindMyTeam()', 'ABEND!');
        process.exit(1);
    }

    logger.trace(__filename, 'FindMyTeam()', UtilJS.format('Parsing JSON: %s', body));
    var teamList = JSON.parse(body);

    logger.trace(__filename, 'FindMyTeam()', UtilJS.format('Searching %d teams for "%s"...', teamList.length, BootstrapData.teamName));
    var teamFound = false;
    for (var currentTeam = 0; currentTeam < teamList.length; currentTeam++) {
        logger.trace(__filename, 'FindMyTeam()', UtilJS.format('Team #%d is "%s"', currentTeam, teamList[currentTeam].name));

        if (BootstrapData.teamName == teamList[currentTeam].name) {
            logger.debug(__filename, 'FindMyTeam()', UtilJS.format('Found "%s" with ID %s', BootstrapData.teamName, teamList[currentTeam].id));
            BootstrapData.teamId = teamList[currentTeam].id;
            teamFound = true;
            break; // we're done searching!
        }
    }

    if (!teamFound) {
        logger.error(__filename, 'FindMyTeam()', UtilJS.format('Could not locate a team with name "%s"!', BootstrapData.teamName));
        logger.debug(__filename, 'FindMyTeam()', 'ABEND!');
        process.exit(1);
    }

    // is there already an active game for this team?
    logger.trace(__filename, 'FindMyTeam()', 'Looking for active games now...');
    makeRequest('http://game.code-camp-2018.com/games/', ParseActiveGames);

    logger.debug(__filename, 'FindMyTeam()', 'Exit Point');
}

function ParseActiveGames(error, response, body) {
    logger.debug(__filename, 'ParseActiveGames()', 'Entry Point');
    if (undefined != error) {
        logger.error(__filename, 'ParseActiveGames()', UtilJS.format('Error retrieving list of active games: %s' + error));
        logger.debug(__filename, 'ParseActiveGames()', 'ABEND!');
        process.exit(1);
    }

    logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Parsing JSON: %s', body));
    var games = JSON.parse(body);
    var gameFound = false;
    logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Checking %d games returned from server...', games.length));
    for (var currentGame = 0; currentGame < games.length; currentGame++) {
        logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Checking game #%d with id %s', currentGame, games[currentGame].gameId));
        logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Team for this game is %s', games[currentGame].team.id));
        if (BootstrapData.teamId == games[currentGame].team.id) {
            // the given team already has a game in progress, end it!
            logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('Game with ID %s matched our team, terminating it!', games[currentGame].gameId));
            shutdownGame(games[currentGame].gameId, createGame);
            gameFound = true; // we found an active game
            break; // assume there could only be one active game...might not be right!
        }
    }

    if (!gameFound) {
        // we didn't find an active game, so go ahead and create a new one
        logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('No active games found for team %s, picking a maze', BootstrapData.teamId));
        pickMaze();
    }

    logger.debug(__filename, 'ParseActiveGames()', 'Exit Point');
}

// determine the maze to use
function pickMaze() {
    logger.debug(__filename, 'pickMaze()', 'Entry Point');
    logger.trace(__filename, 'pickMaze()', UtilJS.format('BootstrapData.specificMaze: %s', BootstrapData.specificMaze));
    logger.trace(__filename, 'pickMaze()', UtilJS.format('BootstrapData.startAtBeginningOfMazeList: %s', BootstrapData.startAtBeginningOfMazeList));

    if (null != BootstrapData.specificMaze) {
        if (BootstrapData.specificMazeStarted ) {
            // we've already run the specific maze, so we're done here!
            logger.info(__filename, 'pickMaze()', 'CONGRATULATIONS - you beat the specific maze!');
            process.exit(0);
        }

        // use the maze specified!
        logger.debug(__filename, 'pickMaze()', UtilJS.format('Using specified maze: %s', BootstrapData.specificMaze));
        BootstrapData.mazeId = BootstrapData.specificMaze;
        logger.trace(__filename, 'pickMaze()', UtilJS.format('Creating game!'));
        BootstrapData.specificMazeStarted = true;
        createGame();
    } else if (BootstrapData.startAtBeginningOfMazeList) {
        if (BootstrapData.currentMaze >= BootstrapData.mazes.length) {
            // we've run all the mazes so we're done here!
            logger.info(__filename, 'pickMaze()', 'CONGRATULATIONS - you beat all the mazes!');
            process.exit(0);
        }

        // start at mazes[0]
        if (null == BootstrapData.currentMaze) {
            BootstrapData.currentMaze = 0;
        }

        logger.debug(__filename, 'pickMaze()', UtilJS.format('Selected maze #%d: %s', BootstrapData.currentMaze, BootstrapData.mazes[BootstrapData.currentMaze]));
        BootstrapData.mazeId = BootstrapData.mazes[BootstrapData.currentMaze++];
        logger.trace(__filename, 'pickMaze()', UtilJS.format('Creating game!'));
        createGame();
    } else {
        // we've got some work to do...
        logger.trace(__filename, 'pickMaze()', 'Requesting the list of scores from the server for our team');
        req('http://score.code-camp-2018.com/get?teamId=' + BootstrapData.teamId, function(error, response, body) {
            logger.debug(__filename, 'pickMaze()-callback()', 'Entry Point');

            if (undefined != error) {
                logger.error(__filename, 'pickMaze()-callback()', UtilJS.format('Error getting scores for team: %s', error));
                logger.debug(__filename, 'pickMaze()-callback()', 'ABEND!');
                process.exit(1);
            }

            logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Parsing JSON: %s', body));
            var scores = JSON.parse(body);

            logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Comparing list of %d mazes to list of %d scores.', BootstrapData.mazes.length, scores.length));
            var foundMazeToPlay = false;
            for (var currentMaze = 0; currentMaze < BootstrapData.mazes.length; currentMaze++) {
                logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Searching scores for a WIN on %s', BootstrapData.mazes[currentMaze]));
                var foundScoreForMaze = false;

                for (var currentScore = 0; currentScore < scores.length; currentScore++) {
                    logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('Examining: %s', JSON.stringify(scores[currentScore])));
                    if (scores[currentScore].mazeId == BootstrapData.mazes[currentMaze] &&
                        scores[currentScore].gameResult == 6) {
                        logger.trace(__filename, 'pickMaze()-callback()', UtilJS.format('A winning score for maze %s has been found!', BootstrapData.mazes[currentMaze]));
                        foundScoreForMaze = true;
                        break; // no need to search any further
                    }
                }

                if (!foundScoreForMaze) {
                    // we've never beaten this maze! use it!
                    logger.debug(__filename, 'pickMaze()-callback()', UtilJS.format('Using this maze: %s', BootstrapData.mazes[currentMaze]));
                    BootstrapData.mazeId = BootstrapData.mazes[currentMaze];
                    foundMazeToPlay = true;
                    break; // we're done here!
                }
            }

            if (!foundMazeToPlay) {
                // we didn't find a maze to launch, we're toast!
                logger.info(__filename, 'pickMaze()-callback()', 'CONGRATULATIONS - you have beat all the games!');
                process.exit(0);
            }

            logger.debug(__filename, 'pickMaze()-callback()', 'Found a maze to play, creating the game!');
            createGame();

            logger.debug(__filename, 'pickMaze()-callback()', 'Exit Point');
        });
    }

    logger.debug(__filename, 'pickMaze()', 'Exit Point');
}

// Create a game
function createGame() {
    logger.debug(__filename, 'createGame()', 'Entry Point');
    logger.trace(__filename, 'createGame()', UtilJS.format('Creating game with:'));
    logger.trace(__filename, 'createGame()', UtilJS.format('  MazeID: %s', BootstrapData.mazeId));
    logger.trace(__filename, 'createGame()', UtilJS.format('  TeamID: %s', BootstrapData.teamId));
    makeRequest('http://game.code-camp-2018.com/game/new/' + BootstrapData.mazeId + '/' + BootstrapData.teamId + '/', function(error, response, body) {
        logger.debug(__filename, 'createGame()-callback()', 'Entry Point');
        if (undefined != error || undefined == body || body.includes("Error creating")) {
            logger.error(__filename, 'createGame()-callback()', 'Error creating game: ' + error + ";" + body);
            logger.debug(__filename, 'createGame()-callback()', 'ABEND!');
            process.exit(1);
        }

        logger.trace(__filename, 'createGame()-callback()', UtilJS.format('Parsing JSON: %s', body));
        var game = JSON.parse(body);
        logger.trace(__filename, 'createGame()-callback()', UtilJS.format('Game URL = %s', game.url));
        var gameId = game.url.replace("http://game.code-camp-2018.com:80/game/", "");
        logger.debug(__filename, 'createGame()-callback()', UtilJS.format('New Game with ID %s created!', gameId));

        logger.debug(__filename, 'createGame()-callback()', 'We\'re ready to play the game!');
        logger.info(__filename, 'createGame()-callback()', 'START THE GAME!');
        playGame(gameId, null);
        logger.debug(__filename, 'createGame()-callback()', 'Exit Point');
    });
    logger.debug(__filename, 'createGame()', 'Exit Point');
}

function playGame(gameId, engram) {
    logger.debug(__filename, 'playGame()', 'Entry Point');

    logger.trace(__filename, 'playGame()', UtilJS.format('Engram: %s', engram));

    // TO-DO Bot Input Timer
    // implement a timer mechanism to avoid anyone taking too long!

    logger.trace(__filename, 'playGame()', 'Asking bots for input');
    var command = CodeCampBot1.takeAction(engram);
    logger.trace(__filename, 'playGame()', 'Bot 1 says: ');
    logger.trace(__filename, 'playGame()', '  Action: ' + command.action);
    logger.trace(__filename, 'playGame()', '  Direction: ' + command.direction);

    logger.trace(__filename, 'playGame()', 'Making our move!');
    makeRequest('http://game.code-camp-2018.com/game/action/'
        + gameId + '?act=' + command.action + '&dir=' + command.direction,
        function(error, response, body) {
            logger.debug(__filename, 'playGame()-callback()', 'Entry Point');
            if (null != error) {
                logger.error(__filename, 'playGame()-callback()', "Error executing action request: " + error);
                shutdownGame(gameId, null);
                logger.debug(__filename, 'playGame()-callback()', 'Aborting game...will shutdown gracefully...');
                return; // don't exit because we need shutdownGame to finish
            }

            logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Parsing JSON: %s', body));
            var responseObj = JSON.parse(body);

            // check to see if we've won!
            logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Iterating over %s outcomes...', responseObj.outcome.length));
            for (var currentOutcome = 0; currentOutcome < responseObj.outcome.length; currentOutcome++) {
                logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Examining outcome #%d: %s', currentOutcome, responseObj.outcome[currentOutcome]));
                if (responseObj.outcome[currentOutcome].includes("Congratulations!")) {
                    // we solved the maze!
                    logger.debug(__filename, 'playGame()-callback()', 'The maze has been solved!');
                    logger.info(__filename, 'playGame()-callback()', "MAZE SOLVED!");
                    // logger.trace(__filename, 'playGame()-callback()', 'Exiting now, nothing left to do.');
                    // process.exit(0);
                    logger.trace(__filename, 'playGame()-callback()', 'Going to the next maze!');
                    pickMaze();
                    return;
                }
            }

            // emit some info
            logger.debug(__filename, 'playGame()-callback()', UtilJS.format('Making move #%d', responseObj.score.moveCount + 1));
            
            // we haven't won, so let's keep playing!
            logger.trace(__filename, 'playGame()-callback()', 'Making our next move!');
            playGame(gameId, responseObj.engram);
            logger.debug(__filename, 'playGame()-callback()', 'Exit Point');
        }
    );
    logger.debug(__filename, 'playGame()', 'Exit Point');
}

function shutdownGame(gameId, callback) {
    logger.debug(__filename, 'shutdownGame()', 'Entry Point');
    makeRequest("http://game.code-camp-2018.com/game/abort/" + gameId + '/beatlemania', function(error, response, body) {
        logger.trace(__filename, 'shutdownGame()-callback()', 'Callback Entry Point');
        
        if (null != error) {
            logger.error(__filename, 'shutdownGame()-callback()', "Error aborting game: " + error);
            logger.debug(__filename, 'shutdownGame()-callback()', "ABEND!");
            process.exit(1);
        }

        logger.trace(__filename, 'shutdownGame()-callback()', UtilJS.format('Parsing JSON: %s', body));
        var obj = JSON.parse(body);
        if (obj.status != 'Game aborted:' + gameId) {
            logger.error(__filename, 'shutdownGame()-callback()', 'Could not shutdown game: ' + obj.status);
            logger.debug(__filename, 'shutdownGame()-callback()', "ABEND!");
            process.exit(1);
        }
    
        if (null != callback) {
            logger.debug(__filename, 'shutdownGame()-callback()', UtilJS.format('Calling %s()...', callback.name));
            callback();
        }
    });
    logger.debug(__filename, 'shutdownGame()', 'Exit Point');
}

function makeRequest(url, callback) {
    logger.debug(__filename, 'makeRequest()', UtilJS.format("Calling %s", url));
    req(url, callback);
}
