const express = require('express');
const innerApp = require('../serveur/server');

const app = express();
app.use('/', innerApp);

module.exports = app;
