const express = require('express');
const app = express();

const maintenance = require('./maintenance');
app.use(maintenance);   


app.use('/api', require('./routes'));
