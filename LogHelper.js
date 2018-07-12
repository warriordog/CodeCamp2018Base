'use strict';

var debugEnabled = true; // when true, debug messages will be logged.

/**
 * @return {text} Localized date and time.
 */
function getTimeStamp() {
    var dt = new Date();
    return dt.toLocaleDateString() + ' ' + dt.toLocaleTimeString();
}

module.exports = {
    // expose debug flag
    debugEnabled: debugEnabled,

    /**
     * Simple console logging function wrapper for INFO messages
     * Info messages are for typical events that should always be logged.
     * 
     * @param {text} file Source File Name, e.g. "Bootstrap.JS"
     * @param {text} method Source Function/Method, e.g. "getUserNameFromId()")
     * @param {text} message Message to log, e.g. "Connecting to server...")
     */
    info: function(file, method, message) {
        if (method) {
            console.log('INFO : [%s] : [%s] : [%s] : [%s]', getTimeStamp(), file, method, message);
        } else {
            console.log('INFO : [%s] : [%s] : [%s]', getTimeStamp(), file, message);
        }
    },

    /**
     * Simple console logging function wrapper for DEBUG messages
     * 
     * Debug messages are generally only logged while debugging or tuning
     * code.  Debug is usually turned off when code is considered complete
     * and running "live in production"
     *  
     * @param {text} file Source File Name, e.g. "Bootstrap.JS"
     * @param {text} method Source Function/Method, e.g. "getUserNameFromId()")
     * @param {text} message Message to log, e.g. "Execution time: 32ms")
     */
    debug: function(file, method, message) {
        if (debugEnabled) {
            if (method) {
                console.log('DEBUG : [%s] : [%s] : [%s] : [%s]', getTimeStamp(), file, method, message);
            } else {
                console.log('DEBUG : [%s] : [%s] : [%s]', getTimeStamp(), file, message);
            }
        };
    },

    /**
     * Simple console logging function wrapper for ERROR messages
     * 
     * Error messages are only logged when an actual error is captured using try/catch.
     * Error messages should almost always be logged when they occur.  
     * 
     * @param {text} file (Source File Name:  "Bootstrap.JS")
     * @param {text} method (Source Function/Method:  "getUserNameFromId()")
     * @param {Error} error (Error that occured)
     */
    error: function error(file, method, error) {
        if (method) {
            console.log('DEBUG : [%s] : [%s] : [%s] : [%s]', getTimeStamp(), file, error);
        } else {
            console.log('DEBUG : [%s] : [%s] : [%s]', getTimeStamp(), file, error);
        }
    },
};
