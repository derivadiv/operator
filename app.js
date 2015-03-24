// Setup: get all required dependencies. 
var express = require('express');
var app = express();

var path = require('path');

//icon
var favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname,'img','favicon.ico')));

app.set('port',(process.env.PORT || 5000));

//other dependencies
var mongoose = require('mongoose');
var passport = require('passport');

var nodemailer = require('nodemailer');
var transporter = require('./config/nodemailer')(nodemailer);

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

var flash = require('express-flash');
var async = require('async');

// Get configuration params, use for db and passport
var configDB = require('./config/database.js');
mongoose.connect(configDB.url);
//error handling
mongoose.connection.on('error', function(err){
    console.log(err);
});
//reconnect when closed?
mongoose.connection.on('disconnected',function(){
    mongoose.connect(configDB.url);
});

// Views setup: ejs template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Setup express
app.use(morgan('dev')); // Logs requests to console
app.use(bodyParser()); // get info from HTML forms
app.use(cookieParser()); // reads cookies (for auth)

app.use(session({ 
    secret: 'teamsingletonrocks',
    resave: false,
    saveUninitialized: false
}));

// Passport setup
require('./config/passport')(passport,transporter);
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); //for flash messages stored in session


// Get styles, css
// Custom
//app.use(express.static(__dirname+'/css'));

//including models
app.use('/models',express.static(__dirname+'/app/models'));
var songmodel = require('./app/models/song').model;
var usermodel = require('./app/models/user');

//other impt file sources
app.use('/img',express.static(__dirname+'/img'));
app.use('/bower_components',express.static(__dirname+'/bower_components'));
app.use('/css',express.static(__dirname+'/css'));
app.use('/js',express.static(__dirname+'/js'));
app.use('/scss',express.static(__dirname+'/scss'));


// Routes
require('./app/routes.js')(app, passport, songmodel, usermodel, transporter, async);

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        title: '500: Internal server error',
        message: err.message,
        error: {}
    });
});

// Launch
var server = app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'));
});

