var cheerio = require('cheerio');
var fs = require('fs');
var request = require('request');

var Twitter = require('twitter');
var time = require('time')(Date);

var client = new Twitter({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

var url = 'http://aragge.ch/cgi-bin/data_frame.pl';

var now = new Date();
now.setTimezone('Europe/Zurich');

var oneHour = 60 * 60 * 1000;
var lastCheck = new Date(now - oneHour);
lastCheck.setTimezone('Europe/Zurich');

var month = [
  "January", "February", "March",
  "April", "May", "June", "July",
  "August", "September", "October",
  "November", "December"
];

var params = {
  start_hour: '' + lastCheck.getHours(),
  hour_count: "24",
  start_day: '' + lastCheck.getDate(),
  start_month_name: month[lastCheck.getMonth()],
  end_day: '' + now.getDate(),
  end_month_name: month[now.getMonth()],
  year: '' + (now.getYear() + 1900),
  m_type:'All%20Types',
  m_airport:'Geneva',
  m_noise_charge:'Geneva',
  Search:'Search'
};


function query(registration, callback) {
  if (registration) {
    params.SelectRegistration = registration;
  }

  var flights = [];

  var p = [];
  for (var i in params) {
          p.push(i + '=' + params[i]);
  }
  var fullUrl = url + '?' + p.join('&');
  request.get(fullUrl, function(error, response, html){
    if(!error){
      var $ = cheerio.load(html);
      var rowTitles = [];
      $('tr').each(function(row, elem) {
        var data = $(this);
        if (row == 0) {
          data.find('th').each(function(col, elem) {
            rowTitles.push($(this).text());
          });
        } else {
          var flight = {};
          data.find('td').each(function(col, elem) {
            flight[rowTitles[col]] = $(this).text();
          });
          flights.push(flight);
        }
      });
      callback(undefined, flights);
    } else {
      callback(error);
    }
  });
}

function loadPlanes() {
  var db = require('./planes.json');
  var planes = { };

  for (var country in db) {
    var countryPlanes = db[country].planes; 
    for (var plane in countryPlanes) {
      planes[plane] = countryPlanes[plane];
    }
  }
  return planes;
}

var testPlanes = { 'HB-JXA' : 1, 'HB-JYN': 1 };

function tweet(str) {
  client.post('statuses/update', {status: str}, function(error, tweet, response){
    if (error) {
      console.error('Failed to tweet: ');
      console.warn(error);
    }
  });
}

var planes = loadPlanes();

query(process.argv[2], function(error, flights) {
  if (error) {
    console.log(error);
  } else {
    //console.warn(flights);
    for (var i in flights) {
      var flight = flights[i];
      var reg = flight['Reg.'];
      if (process.argv[2] || reg in planes) {
        var verb = (flight.M_Type.match(/Landing/) ? 'landed at' : 'left');
        var str =
          (reg in testPlanes ? '(test) A plane' : 'A dictator\'s plane')
          + ' ' + verb + ' #gva airport: '
          + (reg in planes && planes[reg] ? planes[reg] + " (" + reg +')' : reg)
          + ' on ' + flight.Date + ' at ' + flight.Time;
        console.log(str);
        tweet(str);
      }
    }
  }
});
