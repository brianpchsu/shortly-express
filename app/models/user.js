var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');
var Link = require('./link.js')

// var User = db.Model.extend({
//   tableName: 'users',
//   hasTimestamps: true,
//   links: function(){
//     return this.hasMany(Link);
//   }
// });

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  // links: function(){
  //   return this.hasMany(Link);
  // }
  initialize: function(){
    this.on('creating', this.createPassword);
  },
  comparePassword: function(attemptedPassword, callback){
    bcrypt.compare(attemptedPassword, this.get('password'), function(err, isMatch){
      callback(isMatch);
    });
  },
  createPassword: function(){
    var cipher = Promise.promisify(bcrypt.hash);

    return cipher(this.get('password'), null, null)
      .bind(this)
      .then(function(hash) {
        this.set('password', hash);
      });
  }
});

module.exports = User;
