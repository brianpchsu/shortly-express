var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var passport = require('passport');
var GithubStrategy = require('passport-github').Strategy;
var githubcode = require('./githubapp.js');
var auth = require('./auth.js');

var app = express();
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(expressSession({secret:'teamBrian&Tyler'}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new GithubStrategy({
  clientID: githubcode.clientID,
  clientSecret: githubcode.secret,
  callbackURL: 'http://127.0.0.1:4568/auth/callback'
}, function(accessToken, refreshToken, profile, done){
  done(null, {
    accessToken: accessToken,
    profile: profile
  });
}));

passport.serializeUser(function(user, done) {
  // for the time being tou can serialize the user
  // object {accessToken: accessToken, profile: profile }
  // In the real app you might be storing on the id like user.profile.id
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  // If you are storing the whole user on session we can just pass to the done method,
  // But if you are storing the user id you need to query your db and get the user
  //object and pass to done()
  done(null, user);
});

app.get('/auth', passport.authenticate('github'));
app.get('/auth/error', auth.error);
app.get('/auth/callback',
  passport.authenticate('github', {failureRedirect: '/auth/error'}),
  auth.callback
);

// var checkUser = function(req, res, callback){
//   console.dir(req.session.id);

//   // new User({session_id: req.session.id}).fetch().then(function(user) {
//   //   console.log("user is ", user);
//   //   if (!user) {
//   //     res.redirect('/login');
//   //   } else {
//   //     callback();
//   //   }
//   // });
//   if (req.session.username) {
//     callback();
//   } else {
//     res.redirect('/login');
//   }
// };

app.get('/', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/create', util.checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', util.checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/


app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup');
});

app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username }).fetch().then(function(user) {
    if (!user) {
      // res.end("Wrong password");
      res.redirect('/login');
    } else {
      user.comparePassword(password, function(match){
        if (match) {
          req.session.regenerate(function() {
            req.session.username = username;
            res.redirect('/');
          });
        } else {
          res.redirect('/login');
        }
      })
    }
  });

});

app.post('/signup', function(req, res){
  var username = req.body.username;
  var password = req.body.password;

    new User({ username: username })
    .fetch()
    .then(function(user) {
      if(!user){
        var user = new User({
          username: username,
          password: password
        });

        user.save().then(function(newUser){
          Users.add(newUser);
          console.log('added new user');
          req.session.regenerate(function() {
            req.session.username = username;
            res.redirect('/');
          });
        });
      } else {
        console.log("The name is being used!");
        res.redirect('/signup');
      }
    });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
