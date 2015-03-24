module.exports = function(app, passport, songmodel, usermodel, smtpTransport, async) {

	var ObjectId = require('mongoose').Types.ObjectId;
	var crypto = require('crypto');

	// Homepage (with different header based on login status)
	app.get('/', function(req, res) {
		if (req.user) {
			res.render('index.ejs', {
				user: req.user
			});
		} else {
			res.render('index.ejs');
		}
	});

	// Profile: protected, using "route middleware"
	app.get('/profile', isLoggedIn, function(req, res){
		res.render('profile.ejs', {
			user: req.user // get the user out of session and pass to template
		});
	});

	// Uploads: can only be done if logged in
	app.get('/upload', isLoggedIn, function(req, res){
		res.render('upload.ejs', {
			user: req.user // get the user from session and pass to template
		});
	});

	app.post('/upload', isLoggedIn, function(req, res) {
		// TODO switch user._id to email or username? but there's inconsistency between different login types
		var modeldata = makevalidmodel(req.body, req.user._id);
		var example = new songmodel(modeldata);
		example.save(function(err) {
		    if (err !== null){
		        //do something with error :(
		        res.send(500, "An error has occurred -- " + err);
		    } else {
		        //do something with success :)?
				res.redirect('back');
		    }
		});
	});

	// Upload- experimenting stepwise. Only done if logged in
	app.get('/uploadsteps', isLoggedIn, function(req, res){
		// steps should be specified in request, else assume it's the first?
		if (!req.session.steps) {
			req.session.steps = 1;
		}
		if (!req.session.modeldata) {
			req.session.modeldata = {};
		}
		if (!req.session.recIndex) {
			req.session.recIndex = 0;
		}
		res.render('uploadsteps.ejs', {
			user: req.user, // get the user from session and pass to template
			steps: [req.session.steps],
			modeldata: req.session.modeldata,
			recIndex: req.session.recIndex 
		});
	});

	// for testing. may wish to delete later?
	app.get('/upload&:num', isLoggedIn, function(req, res){
		console.log('here');
		// steps should be specified in request, else assume it's the first?
		req.session.steps = Number(req.params.num);
		if (!req.session.modeldata) {
			req.session.modeldata = {};
		}
		if (!req.session.recIndex) {
			req.session.recIndex = 0;
		}
		res.render('uploadsteps.ejs', {
			user: req.user, // get the user from session and pass to template
			steps: [req.session.steps],
			modeldata: req.session.modeldata,
			recIndex: req.session.recIndex
		});
	});

	// Upload step 1: songIDs
	app.post('/uploadsongids', function(req, res) {
		var composername = req.body.composerfirst;
		if (req.body.composermiddle.length > 0) {
			composername += ' ' + req.body.composermiddle;
		}
		composername += ' '+ req.body.composerlast;

		// Make sure unique fields aren't already in database.
		var modeldata = {
			title: req.body.title,
			composer: composername,
			work: req.body.work
		};

		var query = songmodel.find(modeldata);

		query.exec(function(err, arg) {
		    if (!err) {
		    	// if there was an existing entry, we should tell the user
		    	if (arg.length > 0) {
		    		console.log('Doc already existed, not overwriting existing data.');
		    		doc = arg[0];
		    		if (!doc.songtype) {
		    			doc.songtype = req.body.songtype;
		    		}
		    		if (!doc.genre) {
		    			doc.genre = req.body.genre;
		    		}
		    		if (!doc.date) {
		    			doc.date = req.body.date;
		    		}
		    		doc.save(function(err, doc) {
		    			if (!err) {
		    				req.session.steps = 2;
		    				req.session.modeldata = doc;
		    				res.redirect('/uploadsteps');
		    			}
		    		});
		    	}
		    	else {
					//else, we should make/ initialize the model, with additional data if provided
					modeldata.songtype = req.body.songtype;
					modeldata.genre = req.body.genre;
					modeldata.date = req.body.date;

					var example = new songmodel(modeldata);
			    	example.save(function(err, doc) {
					    if (err !== null){
					        //do something with error :(
					        res.send(500, "An error has occurred -- " + err);
					    } else {
					        //do something with success :)?
							req.session.steps = 2;
							req.session.modeldata = doc;
							res.redirect('/uploadsteps');
					    }
					});
		    	}
		    }
		});
	});

	// Upload step 2: lyrics
	app.post('/uploadlyrics', isLoggedIn, function(req, res) {
		var modelid = req.body.modelid; //assuming it still exists, which may not be true

		songmodel.findOne({
			"_id": modelid
		}, function (err, doc) {
			if (err) {
				console.log('problem finding original model');
				res.redirect('back');
			}
			else {
				doc.textauthor = req.body.textauthor;
				doc.language = req.body.language;
				doc.lyrics = req.body.lyrics.split(/(\r|\n)+/);
				if (!doc.credits) {
					doc.credits = {};
				}
				doc.credits.lyrics = {
					userID: req.user._id,
					source: req.body.creditslyrics
				}
				doc.save(function(err, doc) {
					if (err) {
						console.log('something went wrong in update process');
						res.redirect('back');
					}
					else{
						req.session.steps = 3;
						req.session.modeldata = doc;
						res.redirect('/uploadsteps');
					}
				});
			}
		});
	});

	// Upload step 3: translations
	app.post('/uploadtrans', isLoggedIn, function(req, res) {
		var modelid = req.body.modelid; //assuming it still exists, which may not be true
		var tlang = req.body.translang.toLowerCase();

		songmodel.findOne({
			"_id": modelid
		}, function (err, doc) {
			if (err) {
				console.log('problem finding original model');	
				res.redirect('back');
			} 
			else {
				if (!doc.translations) {
					doc.translations = {};
				}	
				doc.translations[tlang] = req.body.translyrics.split(/(\r|\n)+/);

				if (!doc.credits) {
					doc.credits = {};
				}
				doc.credits.translation = {
					userID: req.user._id,
					source: req.body.creditstrans
				}
				doc.save(function(err, doc) {
					if (err) {
						console.log('something went wrong in update process');
						res.redirect('back');
					}
					else{
						req.session.steps = 4;
						req.session.modeldata = doc;
						res.redirect('/uploadsteps');
					}
				});
			}
		});
	});


	// Upload step 4: recording
	app.post('/uploadrecord', isLoggedIn, function(req, res) {
		var modelid = req.body.modelid;
		songmodel.findOne({
			"_id": modelid
		}, function (err, doc) {
			if (err){ 
				console.log('problem finding original model');
				res.redirect('back');
			}
			else {
				var recording = {
					performers: req.body.performers.split(';'),
					type: req.body['type'],
					url: checkUrl(req.body.url)
				};

				if (!doc.recordings) {
					doc.recordings = [];
				}
				doc.recordings.push([recording]);

				if (!doc.credits) {
					doc.credits = {};
				}

				doc.credits.audio = {
					userID: req.user._id
				};
				doc.save(function(err, doc) {
					if (err) {
						console.log('something went wrong in update process');
						res.redirect('back');
					}
					else{
						req.session.steps = 5;
						req.session.modeldata = doc;
						req.session.recIndex = doc.recordings.length-1;//most recently inserted recording?
						res.redirect('/uploadsteps');
					}
				});
			}
		});
	});

	// Upload step 5: timing
	app.post('/uploadtimes', isLoggedIn, function(req, res) {
		var modelid = req.body.modelid;
		var recIndex = req.body.recIndex; 

		songmodel.findOne({
			"_id": modelid
		}, function (err, doc) {
			if (err) {
				console.log('problem finding original model');
				res.redirect('back');
			}
			else {
				doc.recordings[recIndex].times = req.body.times;

				if (!doc.credits) {
					doc.credits = {};
				}
				doc.save(function(err, doc) {
					if (err) {
						console.log('something went wrong in update process');
					}
					else{
						// we're done! 
						console.log('success');
						req.session.steps = null;
						req.session.modeldata = null;
						req.session.recIndex = null;//most recently inserted recording?
						res.redirect('/');
					}
				});
			}
		});
	});

	// Update: protected
	app.post('/playlistupdate', isLoggedIn, function(req, res){
		var user = req.user;
		var songid = req.body.songid;
		var recIndex = req.body.recIndex;
		var playlist = req.body.playlist;

		//find song object by songid
		var query = songmodel.find({
			_id: ObjectId(songid)
		});

		query.exec(function(err, arg) {
		    if (!err & arg.length == 1) {
		    	// Save song to playlist, along with recIndex
		    	var song = {
		    		'song': arg[0],
		    		'recIndex': Number(recIndex)
		    	}
		    	var newplaylists;
				if (typeof req.user.playlists != 'undefined'){
					newplaylists = req.user.playlists;
					if (typeof newplaylists[playlist] == 'undefined'){
						newplaylists[playlist] = [song];
					}
					else {
						newplaylists[playlist].push(song);
					}
				}
				else{
					newplaylists = {};
					newplaylists[playlist] = [song];
				}
				usermodel.update({
					"_id": req.user._id
				}, {
					"playlists": newplaylists
				},{}, function(err, numAffected) {
					if (err || numAffected!=1) {
						console.log('we messed something up, sorry.');
						res.redirect('back');
					}
					else{
						console.log('something worked. yay?')
						res.render('profile.ejs', {
							user: req.user // get the user out of session and pass to template
						});
					}
				});
		    }
		});
	});

	// Add playlist: protected
	app.post('/addplaylist', isLoggedIn, function(req, res){
		var user = req.user;
		var playlist = req.body.newlist;
		// find user
		usermodel.findOne({
			'_id': user._id
		}, function(err, user) {
			if (!user){//something wrong happened if we can't find the user
				res.redirect('/');
			}
			// create playlist with that title if it doesn't already exist
			if (typeof user.playlists[playlist] == 'undefined'){
				user.playlists[playlist] = [];
				user.save(function(err, user){
					//nothing much to do
					console.log(err);
					console.log(user.playlists);
					return;
				});
			}
		});
	});

	// Matches and Playing, meant to display on same page
	app.get('/matches', function(req, res){
		if (req.session.matches) {
			var songattr = req.session.matches;
			req.session.matches = null;
			if (req.user) {
				res.render('index.ejs', {
					user: req.user,
					matchessong: songattr
				});
			} else {
				res.render('index.ejs',{
					matchessong: songattr
				});
			}
		}
	});

	// Play song from selected match
	app.get('/selectmatch', function(req, res){
		var query = songmodel.find({
			_id: ObjectId(req.query.songid)
		});

		query.exec(function(err, arg) {
		    if (!err) {
		    	songattr = process(arg);
		        // default, play first recording if just one song
		        if (songattr.length == 1) {
		        	req.session.song = songattr[0];
		        	res.redirect('/play');
		        } else {
		        	// pass?
		        	if (req.user) {
			        	res.render('index.ejs', {
			        		user: req.user,
							message: 'Something went wrong try searching again.'
						});		        		
		        	} else {
		        		res.render('index.ejs', {
							message: 'Something went wrong, try searching again.'
						});
		        	}
		        }
		    }
		});
   });


	app.get('/play', function(req, res){
		if (req.session.song) {
			var songattr = req.session.song;
			req.session.song = null;
			if (req.user) {
				res.render('index.ejs', {
					user: req.user,
					playsong: songattr
				});
			} else {
				res.render('index.ejs', {
					playsong: songattr
				});
			}
		}
	});

	// custom error page
	app.get('/error', function(req, res){
		res.render('error.ejs');
	});

	// Queries
	app.get('/search', function(req, res){
		// Database-relevant functions
		var queryword = req.query.songsearch;
		var querydata = {
			$or: [
		        {'title': new RegExp(queryword, "i")},
		        {'composer': new RegExp(queryword, "i")},
		        {'work': new RegExp(queryword, "i")}
		    ]
		};
		// Can limit to approved selections or not
		if (req.user && req.user.viewUnapproved) {
			//pass?
		}
		else {
			querydata = {
				$and: [
					querydata,
					{approved: true}
				]
			};
		}

		var query = songmodel.find(querydata).limit(20);

		query.exec(function(err, arg) {
		    if (!err) {
		    	songattr = process(arg);
		        // default, play first recording if just one song
		        if (songattr.length == 1) {
		        	req.session.song = songattr[0];
		        	res.redirect('/play');
		        } else if (songattr.length > 1) {
		        	req.session.matches = songattr;
		        	res.redirect('/matches');
		        } else {
		        	// pass?
		        	if (req.user) {
			        	res.render('index.ejs', {
			        		user: req.user,
							message: 'No matches, try searching again.'
						});		        		
		        	} else {
		        		res.render('index.ejs', {
							message: 'No matches, try searching again.'
						});
		        	}
		        }
		    }
		});
	});

	// Attempt to play songs- TESTING TODO
	app.get('/play2', isLoggedIn, function(req, res){
		//var user = req.user;
		var playsong = req.query.playsong;
		var x = app.render('partials/play',{
			playsong: playsong
		}, function(err, html) {
			res.send(html);
		});
	});
	// Logout
	app.get('/logout', function(req, res){
		req.logout();
		res.redirect('/');
	});

	app.get('/login', function(req, res) {
		res.render('partials/login.ejs', {
			message: 'Invalid credentials.'
		});
	});

	// Process login; passport. TODO
	app.post('/login', passport.authenticate('local-login', {
		successRedirect: '/',
		failureRedirect: '/login',
		failureFlash: true
	}));

	// Signup fail
	app.get('/signupfail', function(req, res) {
		res.render('index.ejs', {
			message: 'That e-mail address is taken.'
		});
	});	

	// Forgetting password: reset by entering email address
	app.get('/forgot', function(req, res) {
		res.render('forgot.ejs', {
			user: req.user
		});
	});	

	app.post('/forgot', function(req, res, next) {
		async.waterfall([
			// Generate unique token
			function(done) {
				crypto.randomBytes(20, function(err, buf) {
					var token = buf.toString('hex');
					done(err, token);
				});
			},
			// Send to user with that email address
			function(token, done) {
				usermodel.findOne({
					'local.email': req.body.email
				}, function(err, user){
					// redirect to forgot if invalid email
					if (!user){
						req.flash('error','No account with that email address exists.');
						return res.redirect('/forgot');
					}
					// else, send email with password token, expires in an hour
					user.resetPasswordToken = token;
					user.resetPasswordExpires = Date.now() + 3600000;
					user.save(function(err){
						done(err, token, user);
					});
				})
			}, 
			// Password reset
			function(token, user, done) {
				// mail text
				var mailOptions = {
					from: 'oper8or.contact@gmail.com',
					to: user.local.email,
					subject: 'Operator Password Reset',
					text: 'You (or someone else) have requested a password reset for your account on Operator (oper8or.herokuapp.com).\n\n' +
						'Click on the following link, or paste into your browser.\n\n'+
						'http://' + req.headers.host + '/reset&'+token + '\n\n' +
						'If you did not request this, please ignore this email and your password will remain unchanged.\n'
				};
				// sending the message
				smtpTransport.sendMail(mailOptions, function(err) {
					req.flash('info', 'An email was sent to '+ user.email + ' with further instructions.');
					return done(err, 'done');
				});
			} 
		], function(err) {
			if (err) {
				return next(err);
			}
			res.redirect('/forgot');
		});
	});	

	//reset link
	app.get('/reset&:token', function(req, res) {
		usermodel.findOne({
			resetPasswordToken: req.params.token,
			resetPasswordExpires: { $gt: Date.now() } 
		}, function(err, user) {
			if (!user) {
				req.flash('error', 'Password reset token invalid or expired.');
				return res.redirect('/forgot');
			}
			res.render('reset', {
				user: req.user
			});
		});
	});

	app.post('/reset&:token', function(req, res) {
		async.waterfall([
			// Find user, update password
			function(done) {
				usermodel.findOne({
					resetPasswordToken: req.params.token,
					resetPasswordExpires: { $gt: Date.now() }
				}, function(err, user) {
					if (!user) {
						req.flash('error', 'Password reset token invalid or expired.');
						return res.redirect('back');
					}
					user.local.password = usermodel.schema.methods.generateHash(req.body.password);
					user.resetPasswordToken = undefined;
					user.resetPasswordExpires = undefined;

					user.save(function(err) {
						req.logIn(user, function(err) {
							done(err, user);
						});
					});
				});
			}, 
			// Send confirmation email
			function(user, done) {
				var mailOptions = {
					to: user.local.email,
					from: 'oper8or.contact@gmail.com',
					subject: 'Your Operator account password has been changed',
					text: 'This is a confirmation that the password for your account on Operator (oper8or.herokuapp.com) has changed.\n'
				};
				smtpTransport.sendMail(mailOptions, function(err) {
					req.flash('success', 'Success! Password was changed.');
					done(err);
				});
			}
		], function(err) {
			res.redirect('/');
		});
	});

	// Process signup; passport. 
	app.post('/signup', passport.authenticate('local-signup', {
		successRedirect: '/',
		failureRedirect: '/signupfail', 
		failureFlash: true
	}));

	// Facebook
	app.get('/auth/facebook', passport.authenticate('facebook', { scope : 'email' }));
	app.get('/auth/facebook/callback', passport.authenticate('facebook', {
		successRedirect : '/profile',
		failureRedirect : '/'
	}));

	// Twitter 
	app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

	app.get('/auth/twitter/callback', passport.authenticate('twitter', {
		successRedirect : '/profile',
		failureRedirect : '/'
	}));

};

// make sure a user is logged in ("route middleware")
function isLoggedIn(req, res, next){
	if (req.isAuthenticated()){
		return next();
	}
	res.redirect('/');
}

// processing song attributes, TODO more fancy operations
function process(results) {
	return results;
}

function makevalidmodel(formdata, userid) {
	var composername = formdata.composerfirst;
	if (formdata.composermiddle.length > 0) {
		composername += ' ' + formdata.composermiddle;
	}
	composername += ' '+ formdata.composerlast;
	var desired = formdata;
	desired.composer = composername;
	desired.lyrics = formdata.lyrics.split(/(\r|\n)+/);
	desired.credits = {};
	if (formdata.creditslyrics.length > 0) {
		desired.credits.lyrics = {
			userID: userid,
			source: formdata.creditslyrics
		}
	}
	desired.credits.audio = {
		userID: userid
	};
	var translang = formdata.translang.toLowerCase(); 
	var translations = {};
	translations[translang] = formdata.translyrics.split(/(\r|\n)+/);
	desired.translations = translations;
	if (formdata.creditstrans.length > 0) {
		desired.credits.translation = {
			userID: userid,
			source: formdata.creditstrans
		}
	}
	//shortcut matching for now
	
	var recording = {
		performers: formdata.performers.split(';'),
		type: formdata.type,
		url: checkUrl(formdata.url),
		times: formdata.times
	};
	desired.recordings = [recording];

	return desired;
}

function checkUrl(url){
	if (!url.length>12){
		var pos = url.search(/watch\?v\=/);
		if (pos>=0) {
			url = url.substr(pos+8,url.length-1);
		}
		else {
			var pos = url.search(/youtu\.be\//);
			if (pos>=0){
				url = url.substr(pos+9, url.length-1);
			}
		} 
		// extra parameters like playlist must get ignored
		var pos = url.search('&');
		if (pos>0){
			url = url.substr(0, pos);
		}
	}
	return url;
}
