'use strict';

 
//////////////////////
// Greenlock Setup  //
//////////////////////
var path = require('path');
var greenlock = require('greenlock-express').create({
  version: 'draft-11' // Let's Encrypt v2
  // You MUST change this to 'https://acme-v02.api.letsencrypt.org/directory' in production
, server: 'https://acme-staging-v02.api.letsencrypt.org/directory'
 
, email: 'me@xcodebuild.com'
, agreeTos: true
, approveDomains: [ 'www.xcodebuild.com' ]
 
  // Join the community to get notified of important updates
  // and help make greenlock better
, communityMember: true
 
, configDir: require('os').homedir() + '/acme/etc'
 
//, debug: true
});
 
//////////////////
// Just add Koa //
//////////////////
 
var http = require('http');
var https = require('https');
var koa = require('koa');
var app = new koa();
 
app.use(require('koa-static')(path.join(__dirname, '../public')));
 
// https server
var server = https.createServer(greenlock.tlsOptions, greenlock.middleware(app.callback()));
 
server.listen(443, function () {
 console.log('Listening at https://localhost:' + this.address().port);
});
 
 
// http redirect to https
var http = require('http');
var redirectHttps = app.use(require('koa-sslify')()).callback();
http.createServer(greenlock.middleware(redirectHttps)).listen(80, function () {
  console.log('Listening on port 80 to handle ACME http-01 challenge and redirect to https');
});

