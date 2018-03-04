/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework.
-----------------------------------------------------------------------------*/
const restify = require('restify');
const builder = require('botbuilder');
const botbuilder_azure = require("botbuilder-azure");
const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;
const scopes  = [
	"https://www.googleapis.com/auth/youtube"
]

process.env['MicrosoftAppId'] = 'd03d7959-06b2-4a56-a2b7-de1023b68bd7';
process.env['MicrosoftAppPassword'] = 'k8S>b5omCfyVkq$9';
process.env['LuisAppId'] = 'f765075e-9aad-4c1e-9a3c-0f13e8862aad';
process.env['LuisAPIKey'] = '9c4f87961624441f86f77cd4b677e41c';
process.env['LuisAPIHostName'] = 'westus.api.cognitive.microsoft.com';

// Setup Restify Server
var server = restify.createServer();
server.use(restify.plugins.queryParser());
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
    session.send('Hello, Welcome to the Youtube Content Creator Assistant!');
    session.send('Please verify your Youtube account to receive assistance.');

    const url = oauth.generateAuthUrl({ access_type: 'online', scope: scopes }) +
      "&state=" + encodeURIComponent(JSON.stringify(session.message.address));

    session.send(new builder.Message(session).addAttachment(
      new builder
        .SigninCard(session)
        .text('Log In to Youtube')
        .button('Log In', url))
    )

});

server.get('/oauth2/callback', function(req, res, next) {
  const { state, code } = req.query
  const address = JSON.parse(state)

  oauth.getToken(code, function(error, tokens) {
    bot.beginDialog(address, '/oauth-success', tokens)
  });

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
  'https://d455b179.ngrok.io/oauth2/callback'
)

var recognizer = new builder.LuisRecognizer(LuisModelUrl);

var intents = new builder.IntentDialog({ recognizers: [recognizer] })
/*.matches('Help', (session) => {
    session.send('You reached Help intent, you said \'%s\'.', session.message.text);
})
.matches('Cancel', (session) => {
    session.send('You reached Cancel intent, you said \'%s\'.', session.message.text);
})*/
.matches('Help', "/help")
.matches("Hello", "/profile")
.matches("Profile", "/profile")
.matches("Logout", "/logout")
.matches()
/*
.matches('<yourIntent>')... See details at http://docs.botframework.com/builder/node/guides/understanding-natural-language/
*/
.onDefault((session) => {
    session.send('Sorry, I did not understand \'%s\'.', session.message.text);
});


bot.dialog("/oauth-success", function(session) {
    session.send('Thank you for logging in with us!');
    var msg = new builder.Message(session)
	.text("Thank you for signing in with us! Choose one of the options below to get started, or     type \'help\' for some more options")
	.suggestedActions(
		builder.SuggestedActions.create(
				session, [
					builder.CardAction.imBack(session, "", "Green"),
					builder.CardAction.imBack(session, "", "Blue"),
					builder.CardAction.imBack(session, "", "Red")
				]
		)
    );

    session.send(msg);
});

bot.dialog('LikeQuery', [
    function(session, args, next) {
        session.send("")
    }
]).triggerAction({
    matches: 'LikeQuery',
    onInterrupted: function(session) {
        session.send("")
    }
})
