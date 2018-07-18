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
delete require.cache['data/data.json'];

// load utilities
require('dotenv').config();
var LoggerJS = require('./Logger.js');
var UtilJS = require('util');
var fs = require('fs'); // file system - allows reading and writing files
var BootstrapData = 
{
    // these can be overridden by the camper's data file
    runAllBots: true,
    singleBotToRun: null,
    specificMaze: null,
    startAtBeginningOfMazeList: false,

    // set at the repository level, shouldn't be changed by teams
    teamName: "Intern Invasion",
    mazes: [
        "3:3:TinyTim",
        "10:10:SlipperyDevil",
        "10:10:SnarkyShark",
        "10:10:Snippy",
        "20:20:ZippyZoomer",
    ],
    minimumCycleTime: 10,
    numberOfBots: 6,
};

const GAME_SERVER_URL = process.env.GAME_SERVER_URL || 'http://game.code-camp-2018.com';
const SCORE_SERVER_URL = process.env.SCORE_SERVER_URL || 'http://score.code-camp-2018.com';

// configure the logger
var logger = LoggerJS.Logger.getInstance(); // simple logging wrapper
logger.setLogLevel(LoggerJS.LOG_LEVELS["DEBUG"]);
logger.trace(__filename, '', 'Logger initialized...');

if (fs.existsSync('./data/data.json')) {
    logger.debug(__filename, '', 'Override data exists, loading...');
    var OverrideData = require('./data/data');

    // override Bootstrap data
    if (OverrideData.runOneBot === true &&
        null != OverrideData.botToRun &&
        OverrideData.botToRun > 0 &&
        OverrideData.botToRun <= BootstrapData.numberOfBots) {
        logger.debug(__filename, '', UtilJS.format('Running only bot #%d.', OverrideData.botToRun));
        BootstrapData.runAllBots = false;
        BootstrapData.singleBotToRun = OverrideData.botToRun;
    }
    if (OverrideData.specificMaze != null) {
        logger.debug(__filename, '', UtilJS.format('Running only maze %s.', OverrideData.specificMaze));
        BootstrapData.specificMaze = OverrideData.specificMaze;
    } else if (OverrideData.playAllMazes === true) {
        logger.debug(__filename, '', 'Running all mazes.');
        BootstrapData.startAtBeginningOfMazeList = true;
    }
    if (OverrideData.logLevel != null &&
        (OverrideData.logLevel == "NONE" || OverrideData.logLevel == "ERROR" ||
        OverrideData.logLevel == "WARN" || OverrideData.logLevel == "INFO" ||
        OverrideData.logLevel == "DEBUG" || OverrideData.logLevel == "TRACE")) {
        logger.debug(__filename, '', UtilJS.format('Setting log level to %s.', OverrideData.logLevel));
        logger.setLogLevel(LoggerJS.LOG_LEVELS[OverrideData.logLevel]);
    }
}

// Load the required modules
logger.trace(__filename, '', 'Load "request" library...');
var req = require('request');

// Load the CodeCamp Bots (These are the files you'll be working in!)
logger.trace(__filename, '', 'Load Code Camp bots...');
var CodeCampBots = [];
for (var currentBot = 0; currentBot < BootstrapData.numberOfBots; currentBot++) {
    if (BootstrapData.runAllBots || BootstrapData.singleBotToRun == (currentBot + 1)) {
        logger.trace(__filename, '', UtilJS.format('Loading Bot #%d', currentBot + 1));
        CodeCampBots[currentBot] = require(UtilJS.format('./Bots/CodeCamp-Bot%d', currentBot + 1));
}
}

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
makeRequest(GAME_SERVER_URL + '/teams', FindMyTeam);

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
            BootstrapData.botData = teamList[currentTeam].bots;
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
    makeRequest(GAME_SERVER_URL + '/games/', ParseActiveGames);

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
        logger.trace(__filename, 'ParseActiveGames()', UtilJS.format('Bot for this game is %s', games[currentGame].score.botId));
        if (BootstrapData.runAllBots) {
            if (BootstrapData.teamId == games[currentGame].team.id && games[currentGame].score.botId == "") {
                // the given team already has a game in progress, end it!
                logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('Game with ID %s matched our team, terminating it!', games[currentGame].gameId));
                shutdownGame(games[currentGame].gameId, pickMaze);
                gameFound = true; // we found an active game
                break; // assume there could only be one active game...might not be right!
            }
        } else {
            if (BootstrapData.teamId == games[currentGame].team.id &&
                BootstrapData.botData[BootstrapData.singleBotToRun-1].id == games[currentGame].score.botId) {
                // the given team already has a game in progress, end it!
                logger.debug(__filename, 'ParseActiveGames()', UtilJS.format('Game with ID %s matched our team, terminating it!', games[currentGame].gameId));
                shutdownGame(games[currentGame].gameId, pickMaze);
                gameFound = true; // we found an active game
                break; // assume there could only be one active game...might not be right!
            }
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
function pickMaze(wonLastMaze) {
    logger.debug(__filename, 'pickMaze()', 'Entry Point');
    logger.trace(__filename, 'pickMaze()', UtilJS.format('  wonLastMaze = %s', wonLastMaze));
    logger.trace(__filename, 'pickMaze()', UtilJS.format('BootstrapData.specificMaze: %s', BootstrapData.specificMaze));
    logger.trace(__filename, 'pickMaze()', UtilJS.format('BootstrapData.startAtBeginningOfMazeList: %s', BootstrapData.startAtBeginningOfMazeList));

    if (null != BootstrapData.specificMaze) {
        if (BootstrapData.specificMazeStarted) {
            if (wonLastMaze == true) {
                // we've already run the specific maze, so we're done here!
                logger.info(__filename, 'pickMaze()', 'CONGRATULATIONS - you beat the specific maze!');
                process.exit(0);
            }
        }

        // use the maze specified!
        logger.debug(__filename, 'pickMaze()', UtilJS.format('Using specified maze: %s', BootstrapData.specificMaze));
        BootstrapData.mazeId = BootstrapData.specificMaze;
        logger.trace(__filename, 'pickMaze()', UtilJS.format('Creating game!'));
        BootstrapData.specificMazeStarted = true;
        createGame();
    } else if (BootstrapData.startAtBeginningOfMazeList) {
        if (wonLastMaze) {
            BootstrapData.currentMaze++; // go back a maze!
        }

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
        BootstrapData.mazeId = BootstrapData.mazes[BootstrapData.currentMaze];
        logger.trace(__filename, 'pickMaze()', UtilJS.format('Creating game!'));
        createGame();
    } else {
        // we've got some work to do...
        logger.trace(__filename, 'pickMaze()', 'Requesting the list of scores from the server for our team');
        req(SCORE_SERVER_URL + '/get?teamId=' + BootstrapData.teamId, function(error, response, body) {
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
    var actionUrl;
    if (!BootstrapData.runAllBots) {
        logger.trace(__filename, 'createGame()', UtilJS.format('  BotID: %s', BootstrapData.botData[BootstrapData.singleBotToRun-1].id));
        actionUrl = UtilJS.format(GAME_SERVER_URL + '/game/new/%s/%s/%s/',
            BootstrapData.mazeId, BootstrapData.teamId, BootstrapData.botData[BootstrapData.singleBotToRun-1].id);
    } else {
        actionUrl = UtilJS.format(GAME_SERVER_URL + '/game/new/%s/%s/',
            BootstrapData.mazeId, BootstrapData.teamId);
    }

    makeRequest(actionUrl, function(error, response, body) {
        logger.debug(__filename, 'createGame()-callback()', 'Entry Point');
        if (undefined != error || undefined == body || body.includes("Error creating")) {
            logger.error(__filename, 'createGame()-callback()', 'Error creating game: ' + error + ";" + body);
            logger.debug(__filename, 'createGame()-callback()', 'ABEND!');
            process.exit(1);
        }

        logger.trace(__filename, 'createGame()-callback()', UtilJS.format('Parsing JSON: %s', body));
        var game = JSON.parse(body);

        if (!game.status.toLowerCase().includes('game created')) {
            logger.error(__filename, 'createGame()-callback()', 'Error received when creating game:');
            logger.error(__filename, 'createGame()-callback()', JSON.stringify(game));
            process.exit(1);
        }

        logger.trace(__filename, 'createGame()-callback()', UtilJS.format('Game URL = %s', game.url));
        var gameId;
        if (undefined === game.gameId) {
            gameId = game.url.substring(game.url.lastIndexOf('/')+1);
        } else {
            gameId = game.gameId;
        }
        logger.debug(__filename, 'createGame()-callback()', UtilJS.format('New Game with ID %s created!', gameId));

        logger.debug(__filename, 'createGame()-callback()', 'We\'re ready to play the game!');
        logger.info(__filename, 'createGame()-callback()', 'START THE GAME!');
        playGame(gameId, null);
        logger.debug(__filename, 'createGame()-callback()', 'Exit Point');
    });
    logger.debug(__filename, 'createGame()', 'Exit Point');
}

function playGame(gameId, gameState) {
    logger.debug(__filename, 'playGame()', 'Entry Point');

    // get the timestamp to help throttle
    var playGameStartTS = Date.now();

    logger.trace(__filename, 'playGame()', UtilJS.format('Engram: %s', gameState));

    if (null != gameState) {
        logger.trace(__filename, 'playGame()', UtilJS.format("Parsing player state %d", gameState.playerState));
        switch (gameState.playerState) {
            case 1: {
                gameState.playerState = "Sitting";
                break;
            }
            case 2: {
                gameState.playerState = "Standing";
                break;
            }            
            case 4: {
                gameState.playerState = "Lying";
                break;
            }
            case 8: {
                gameState.playerState = "Stunned";
                break;
            }
            case 512: {
                gameState.playerState = "DEAD";
                break;
            }
        }

        logger.trace(__filename, 'playGame()', UtilJS.format("Player state = %s", gameState.playerState));
    }

    var botCommands = [];
    logger.trace(__filename, 'playGame()', UtilJS.format('Iterating over %d bots', BootstrapData.numberOfBots));
    for (var currentBot = 0; currentBot < BootstrapData.numberOfBots; currentBot++) {
        if (BootstrapData.runAllBots || BootstrapData.singleBotToRun == (currentBot+1)) {
            logger.trace(__filename, 'playGame()', UtilJS.format('Asking Bot %d for input', currentBot+1));
            botCommands[currentBot] = CodeCampBots[currentBot].takeAction(gameState);
            logger.trace(__filename, 'playGame()', UtilJS.format('Bot %d says:', currentBot+1));
            logger.trace(__filename, 'playGame()', '  Action: ' + botCommands[currentBot].action);
            logger.trace(__filename, 'playGame()', '  Direction: ' + botCommands[currentBot].direction);
        } else {
            botCommands[currentBot] = {action: null, direction: null, message: null};
        }
    }

    logger.trace(__filename, 'playGame()', UtilJS.format('Weighting results from %d bots', botCommands.length));
    var weightedResults = {
        actions: {},
        directions: {},
        messages: {},
    };
    for (var currentBot = 0; currentBot < botCommands.length; currentBot++) {
        logger.trace(__filename, 'playGame()', UtilJS.format('Examining bot #%d', currentBot+1));
        if (null != botCommands[currentBot].action) {
            logger.trace(__filename, 'playGame()', UtilJS.format('   - weighting action %s', botCommands[currentBot].action));
            if (botCommands[currentBot].action in weightedResults.actions) {
                weightedResults.actions[botCommands[currentBot].action] += BootstrapData.botData[currentBot].weight/100;
            } else {
                weightedResults.actions[botCommands[currentBot].action] = BootstrapData.botData[currentBot].weight/100;
            }
            logger.trace(__filename, 'playGame()', UtilJS.format('     - result: %f', weightedResults.actions[botCommands[currentBot].action]));
        }
        if (null != botCommands[currentBot].direction) {
            logger.trace(__filename, 'playGame()', UtilJS.format('   - weighting direction %s', botCommands[currentBot].direction));
            if (botCommands[currentBot].direction in weightedResults.directions) {
                weightedResults.directions[botCommands[currentBot].direction] += BootstrapData.botData[currentBot].weight/100;
            } else {
                weightedResults.directions[botCommands[currentBot].direction] = BootstrapData.botData[currentBot].weight/100;
            }
            logger.trace(__filename, 'playGame()', UtilJS.format('     - result: %f', weightedResults.directions[botCommands[currentBot].direction]));
        }
        if (null != botCommands[currentBot].message) {
            logger.trace(__filename, 'playGame()', UtilJS.format('   - weighting message %s', botCommands[currentBot].message));
            if (botCommands[currentBot].message in weightedResults.messages) {
                weightedResults.messages[botCommands[currentBot].message] += BootstrapData.botData[currentBot].weight/100;
            } else {
                weightedResults.messages[botCommands[currentBot].message] = BootstrapData.botData[currentBot].weight/100;
            }
            logger.trace(__filename, 'playGame()', UtilJS.format('     - result: %f', weightedResults.messages[botCommands[currentBot].message]));
        }
    }

    logger.trace(__filename, 'playGame()', 'Picking highest score...');
    var winningCommand = {
        action: {
            value: null,
            weight: 0,
        },
        direction: {
            value: null,
            weight: 0,
        },
        message: {
            value: null,
            weight: 0,
        },
    };
    logger.trace(__filename, 'playGame()', 'Examining actions to determine winner...');
    for (var action in weightedResults.actions) {
        logger.trace(__filename, 'playGame()', UtilJS.format('  Examining "%s" with weight %f', action, weightedResults.actions[action]));
        if (weightedResults.actions[action] > winningCommand.action.weight) {
            logger.trace(__filename, 'playGame()', UtilJS.format('    %s has won at %f weight vs. %s at %f weight',
                action, weightedResults.actions[action], winningCommand.action.value, winningCommand.action.weight
            ));
            winningCommand.action.weight = weightedResults.actions[action];
            winningCommand.action.value = action;
        }
    }
    logger.trace(__filename, 'playGame()', 'Examining directions to determine winner...');
    for (var direction in weightedResults.directions) {
        logger.trace(__filename, 'playGame()', UtilJS.format('  Examining "%s" with weight %f', direction, weightedResults.directions[direction]));
        if (weightedResults.directions[direction] > winningCommand.direction.weight) {
            logger.trace(__filename, 'playGame()', UtilJS.format('    %s has won at %f weight vs. %s at %f weight',
                direction, weightedResults.directions[direction], winningCommand.direction.value, winningCommand.direction.weight
            ));
            winningCommand.direction.weight = weightedResults.directions[direction];
            winningCommand.direction.value = direction;
        }
    }
    logger.trace(__filename, 'playGame()', 'Examining messages to determine winner...');
    for (var message in weightedResults.messages) {
        logger.trace(__filename, 'playGame()', UtilJS.format('  Examining "%s" with weight %f', message, weightedResults.messages[message]));
        if (weightedResults.messages[message] > winningCommand.message.weight) {
            logger.trace(__filename, 'playGame()', UtilJS.format('    %s has won at %f weight vs. %s at %f weight',
                message, weightedResults.messages[message], winningCommand.message.value, winningCommand.message.weight
            ));
            winningCommand.message.weight = weightedResults.messages[message];
            winningCommand.message.value = message;
        }
    }

    logger.trace(__filename, 'playGame()', 'Producing cohesion results...');
    var cohesionScores = [];
    for (var currentBot = 0; currentBot < botCommands.length; currentBot++) {
        if (BootstrapData.runAllBots || BootstrapData.singleBotToRun == (currentBot+1)) {
        if (botCommands[currentBot].action != null || botCommands[currentBot].direction != null) {
            cohesionScores[currentBot] = 0;
        } else {
            cohesionScores[currentBot] = null;
        }
        
        if (botCommands[currentBot].action == winningCommand.action.value) {
            cohesionScores[currentBot] == null ? cohesionScores[currentBot] = 0.34 : cohesionScores[currentBot] += 0.34;
        }
        if (botCommands[currentBot].direction == winningCommand.direction.value) {
            cohesionScores[currentBot] == null ? cohesionScores[currentBot] = 0.34 : cohesionScores[currentBot] += 0.34;
        }
        if (botCommands[currentBot].message == winningCommand.message.value) {
            cohesionScores[currentBot] == null ? cohesionScores[currentBot] = 0.32 : cohesionScores[currentBot] += 0.32;
        }
        } else {
            cohesionScores[currentBot] = 0;
        }
        logger.trace(__filename, 'playGame()', UtilJS.format('  Result for Bot #%d = %f', currentBot+1, cohesionScores[currentBot]));
    }

    // build the interleaved message
    logger.trace(__filename, 'playGame()', 'Interleaving messages...');
    var interleavedMessage = "";
    for (var message in weightedResults.messages) {
        logger.trace(__filename, 'playGame()', UtilJS.format('  Interleaving "%s" with "%s"', message, interleavedMessage));
        if (null != message) {
            interleavedMessage = interleaveText(interleavedMessage, message);
        }
    }
    logger.trace(__filename, 'playGame()', UtilJS.format('Interleaving result = "%s"', interleavedMessage));

    var actionPayload = {
        gameId: gameId,
        action: winningCommand.action.value != null ? winningCommand.action.value : "none",
        direction: winningCommand.direction.value != null ? winningCommand.direction.value : "none",
        message: interleavedMessage,
        cohesionScores: cohesionScores,
    };

    logger.trace(__filename, 'playGame()', 'Making our move!');
    makeReliablePost(GAME_SERVER_URL + '/game/action/', actionPayload, function(error, response, body) {
        logger.debug(__filename, 'playGame()-callback()', 'Entry Point');
        if (null != error) {
            logger.error(__filename, 'playGame()-callback()', "Error executing action request: " + error);
            shutdownGame(gameId, null);
            logger.debug(__filename, 'playGame()-callback()', 'Aborting game...will shutdown gracefully...');
            return; // don't exit because we need shutdownGame to finish
        }

        if (response.statusCode == 400) {
            logger.error(__filename, 'playGame()-callback()', 'Error making move:');
            logger.error(__filename, 'playGame()-callback()', JSON.stringify(body));
        } else {
            logger.trace(__filename, 'playGame()-callback()', UtilJS.format('JSON returned: %s', body));
            var responseObj = body;
    
            // are we dead?
            if (responseObj.playerState & 512) {
                logger.info(__filename, 'playGame()-callback()', "YOU HAVE DIED!");
                logger.trace(__filename, 'playGame()-callback()', 'Going to the next maze!');
                pickMaze(false);
                return;
            }
    
            // check to see if we've won!
            logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Iterating over %s outcomes...', responseObj.outcome.length));
            for (var currentOutcome = 0; currentOutcome < responseObj.outcome.length; currentOutcome++) {
                logger.trace(__filename, 'playGame()-callback()', UtilJS.format('Examining outcome #%d: %s', currentOutcome, responseObj.outcome[currentOutcome]));
                if (responseObj.outcome[currentOutcome].includes("Congratulations!")) {
                    // we solved the maze!
                    logger.info(__filename, 'playGame()-callback()', "MAZE SOLVED!");
                    logger.trace(__filename, 'playGame()-callback()', 'Going to the next maze!');
                    pickMaze(true);
                    return;
                }
                if (responseObj.outcome[currentOutcome].includes("YOU HAVE DIED")) {
                    // we're dead, Jim...
                    logger.info(__filename, 'playGame()-callback()', "YOU HAVE DIED!");
                    logger.trace(__filename, 'playGame()-callback()', 'Going to the next maze!');
                    pickMaze(false);
                    return;
                }
            }
    
            // we haven't won, so let's keep playing!
            logger.debug(__filename, 'playGame()-callback()', UtilJS.format('Making move #%d', responseObj.score.moveCount + 1));
        }

        // but first make sure we aren't moving TOO fast
        var playGameEndTS = Date.now();
        if (playGameEndTS - playGameStartTS < BootstrapData.minimumCycleTime) {
            // we've gone too fast!
            var delayInMS = BootstrapData.minimumCycleTime - (playGameEndTS - playGameStartTS);
            setTimeout(function() {
                logger.trace(__filename, 'playGame()-callback()', 'Making our next move!');
                playGame(gameId, responseObj);
            }, delayInMS);
        } else {
            logger.trace(__filename, 'playGame()-callback()', 'Making our next move!');
            playGame(gameId, responseObj);    
        }

        logger.debug(__filename, 'playGame()-callback()', 'Exit Point');
    });
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

/*
function makeReliableRequest(theUrl, callback, currentTry) {
    logger.debug(__filename, 'makeReliableRequest()', UtilJS.format("Calling %s", theUrl));
    req({url: theUrl, timeout: 6000}, function(error, response, body) {
        logger.trace(__filename, 'makeReliableRequest()-callback()', 'Entry Point');

        if (null != error && error.code == "ETIMEDOUT") {
            logger.warn(__filename, 'makeReliableRequest()-callback()', 'REQUEST TIMED OUT! Trying to recover...');
            if (null == currentTry) {
                currentTry = 1;
            } else {
                currentTry++;
            }

            if (currentTry < 10) {
                logger.trace(__filename, 'makeReliableRequest()-callback()', UtilJS.format('Attempting try #%d', currentTry));
                makeReliableRequest(theUrl, callback, currentTry);
                return;
            } // if tries are exceeded, TIMEOUT will be passed to the callback() for handling
        }

        logger.trace(__filename, 'makeReliableRequest()-callback()', UtilJS.format('Calling %s()...', callback.name));
        callback(error, response, body);

        logger.trace(__filename, 'makeReliableRequest()-callback()', 'Exit Point');
    });
}
*/

function makeReliablePost(theUrl, postBody, callback, currentTry) {
    logger.debug(__filename, 'makeReliablePost()', UtilJS.format("Calling %s", theUrl));
    logger.trace(__filename, 'makeReliablePost()', UtilJS.format("  Body: %s", JSON.stringify(postBody)));
    var options = {
        url: theUrl,
        json: postBody,
        timeout: 6000,
        headers: {
            'Content-Type': "application/json",
        },
    };

    req.post(options, function(error, response, body) {
        logger.trace(__filename, 'makeReliablePost()-callback()', 'Entry Point');

        if (null != error && error.code == "ETIMEDOUT") {
            logger.warn(__filename, 'makeReliablePost()-callback()', 'REQUEST TIMED OUT! Trying to recover...');
            if (null == currentTry) {
                currentTry = 1;
            } else {
                currentTry++;
            }

            if (currentTry < 10) {
                logger.trace(__filename, 'makeReliablePost()-callback()', UtilJS.format('Attempting try #%d', currentTry));
                makeReliablePost(theUrl, postBody, callback, currentTry);
                return;
            } // if tries are exceeded, TIMEOUT will be passed to the callback() for handling
        }

        logger.trace(__filename, 'makeReliablePost()-callback()', UtilJS.format('Calling %s()...', callback.name));
        callback(error, response, body);

        logger.trace(__filename, 'makeReliablePost()-callback()', 'Exit Point');
    });
}

function interleaveText(str1, str2) {
    var result = "";
    var currentCharacter;
    var numberOfCharacters = str1.length > str2.length ? str1.length : str2.length;

    for (var currentCharacter = 0; currentCharacter < numberOfCharacters; currentCharacter++) {
        if (currentCharacter < str1.length) {
            result += str1[currentCharacter];
        }
        if (currentCharacter < str2.length) {
            result += str2[currentCharacter];
        }
    }

    return result;
}
