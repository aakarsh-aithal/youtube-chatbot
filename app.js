/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework.
-----------------------------------------------------------------------------*/
const restify = require('restify');
const builder = require('botbuilder');
const botbuilder_azure = require("botbuilder-azure");
const { google } = require('googleapis');
const service = google.youtube('v3');
const OAuth2 = google.auth.OAuth2;
const scopes  = [
	"https://www.googleapis.com/auth/youtube"
]

if(!process.env['WebsiteURL']) {
  process.env['WebsiteURL'] = 'https://1e113005.ngrok.io'
}
process.env['MicrosoftAppId'] = 'd03d7959-06b2-4a56-a2b7-de1023b68bd7';
process.env['MicrosoftAppPassword'] = 'k8S>b5omCfyVkq$9';
process.env['LuisAppId'] = 'f765075e-9aad-4c1e-9a3c-0f13e8862aad';
process.env['LuisAPIKey'] = '9c4f87961624441f86f77cd4b677e41c';
process.env['LuisAPIHostName'] = 'westus.api.cognitive.microsoft.com';

// Setup Restify Server
var server = restify.createServer();
server.use(restify.plugins.queryParser());
server.use(
  function crossOrigin(req,res,next){
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    return next();
  }
)
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot.
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

var inMemoryStorage = new builder.MemoryBotStorage();

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector, function (session) {
  if(Object.keys(oauth.credentials).length === 0) {
    session.send('Hello, Welcome to the Youtube Content Creator Assistant!');
    session.send('Please verify your Youtube account to receive assistance.');

    const url = oauth.generateAuthUrl({ access_type: 'offline', scope: scopes, prompt: 'consent' }) +
      "&state=" + encodeURIComponent(JSON.stringify(session.message.address));

    session.send(new builder.Message(session).addAttachment(
      new builder
        .SigninCard(session)
        .text('Log In to Youtube')
        .button('Log In', url))
    )
    session.endDialog()
  } else {
    var msg = new builder.Message(session)
    .text("Choose one of the options below to get started, or type \'help\' for some more options")
    .suggestedActions(
      builder.SuggestedActions.create(
          session, [
            builder.CardAction.postBack(session, "/help", "Help"),
          ]
      )
    );
    session.send(msg);
    session.beginDialog("/root");
  }
});

server.get('/oauth2/callback', function(req, res, next) {
    console.log('hi');
  const { state, code } = req.query
  const address = JSON.parse(state)

  oauth.getToken(code, function (error, tokens) {
    if (!error) {
      console.log(tokens)
      oauth.setCredentials(tokens);
    }
    bot.beginDialog(address, '/oauth-success', error)
  })

  res.send(200);
});

bot.set('storage', inMemoryStorage);

// Make sure you add code to validate these fields
var luisAppId = process.env.LuisAppId;
var luisAPIKey = process.env.LuisAPIKey;
var luisAPIHostName = process.env.LuisAPIHostName || 'westus.api.cognitive.microsoft.com';

const LuisModelUrl = 'https://' + luisAPIHostName + '/luis/v1/application?id=' + luisAppId + '&subscription-key=' + luisAPIKey;

// Main dialog with LUIS
// Initialize with the strategies we want to use
const oauth = new OAuth2(
  '589477556905-quf7iv29vmha2260418upbe67fkme70j.apps.googleusercontent.com',
  'vqKfpDUXXFx2tu6_H4IIXbjd',
  process.env.WebsiteURL + '/oauth2/callback'
)

google.options({
  auth: oauth
})

var recognizer = new builder.LuisRecognizer(LuisModelUrl);

var intents = new builder.IntentDialog({ recognizers: [recognizer] })
.matches("Help", "/help")
.matches("Likes", '/likes')
.matches("Subscribers", '/subscriber')
.onDefault((session) => {
    session.send('Sorry, I did not understand \'%s\'.', session.message.text);
});

bot.dialog("/root", intents);

bot.dialog("/oauth-success", function(session, result) {
  if(result) {
    session.send('Please try signing in again.');
    session.replaceDialog('/');
  } else {
    session.send('Thank you for signing in with us!');
    session.replaceDialog('/help')
  }
});


bot.dialog('/help', [
    function(session) {

      var questions = '**The following are just a couple of questions you can prompt:** \n' +
              '* How is my video doing? \n' +
              '* How many views do I have? \n' +
              '* How many subs do I have? \n'
        session.send({
          textFormat: 'markdown',
          text: questions
        });
        session.replaceDialog('/')
    }
]);

bot.dialog('/likes', [
    function(session, args, next) {
        var videosData = {};
        var videosDataTitles = '';
        service.channels.list({
          mine: true,
          part: 'id,contentDetails'
        }, function(error, result) {
          if(error) {
            next();
          }

          const channelUploads = result.data.items[0].contentDetails.relatedPlaylists.uploads
          const requestOptions = {
            playlistId: channelUploads,
            part: 'snippet',
            maxResults: 5
          };

          service.playlistItems.list(requestOptions,
          function(error, result) {
            if(error) {
              next();
            }
            console.log(result);
            var playlistItems = result.data.items;
            console.log(playlistItems);
            session.privateConversationData.videoIDs = playlistItems.map((curr) => curr.snippet.resourceId.videoId);
            
            for(var i=0; i < playlistItems.length; i++) {
              videosData[i + 1] = playlistItems[i];
            }

            videosDataTitles = playlistItems
                                    .reduce((accum, curr, i) => `${accum} \n ${i+1}. ${curr.snippet.title}`, "")
            var selections = 'Of which of the following videos?' + videosDataTitles;
            builder.Prompts.choice(session, selections, videosData, { listStyle: 3 });
          })
        })
        
    },
    function(session, result, next) {
        var videoIDs = session.privateConversationData.videoIDs;
        if(result.response) {
            var videoID = videoIDs[result.response.index];
            console.log(videoID);
            const requestOptions = {
                id: videoID,
                part: 'snippet,statistics',
                maxResults: 1
              };
            service.videos.list(requestOptions, function(err, result) {
              if(err) {
                return;
              }
              var video = result.data.items[0];
              var likeCount = video.statistics.likeCount;
              var dislikeCount = video.statistics.dislikeCount;
              var title = video.snippet.title;
              session.send(`You have ${likeCount} likes and ${dislikeCount} on video ${title}`);
              session.endDialog();
            })
        } else {
          session.send('There was an error processing your request');
        } 
        
    }
]).triggerAction({
    onInterrupted: function(session) {
        session.send("Please Try Again")
    }
})



/*
playlistItems is array of youtube video objects
format:

{ kind: 'youtube#playlistItem',
  etag: '"_gJQceDMxJ8gP-8T2HLXUoURK8c/75qYAfFn7WO-a2o-s6Pv_ypskCE"',
  id: 'VVV6S1FxNmIxM0JjakNQZ19iZ3c1bUtBLlRmTkFSTUtaM01V',
  snippet:
   { publishedAt: '2018-03-04T00:32:20.000Z',
     channelId: 'UCzKQq6b13BcjCPg_bgw5mKA',
     title: 'Deleted Episode of The Office',
     description: '',
     thumbnails: [Object],
     channelTitle: 'Dennis Park',
     playlistId: 'UUzKQq6b13BcjCPg_bgw5mKA',
     position: 0,
     resourceId: [Object] } },
*/