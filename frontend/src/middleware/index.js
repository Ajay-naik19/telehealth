const auth = require('./auth');
const errorHandler = require('./errorHandler');
const validation = require('./validation');

module.exports = {
    ...auth,
    errorHandler,
    validation
};