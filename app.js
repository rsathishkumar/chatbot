/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework. 
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var botbuilder_azure = require("botbuilder-azure");
var builder_cognitiveservices = require("botbuilder-cognitiveservices");
const _ = require('lodash');
const SQLProcessing = require('./SQLProcessing');
var PhoneNumber = require( 'awesome-phonenumber' );
var QnAMakerDialogSerialNum = require( './QnAMakerDialogSerialNum' );



// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    openIdMetadata: process.env.BotOpenIdMetadata 
});

// new valid token is automatically stored to the bot
setInterval(() => {
    connector.getAccessToken((error) => {
            console.log(JSON.stringify(error));
        }, (token) => {
            console.log(`token refreshed: ${token}`); 
        });
}, 30 * 60 * 1000 /* 30 minutes in milliseconds*/ );

// Listen for messages from users 
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot. 
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

//var tableName = 'botdata';
//var azureTableClient = new botbuilder_azure.AzureTableClient(tableName, process.env['AzureWebJobsStorage']);
//var tableStorage = new botbuilder_azure.AzureBotStorage({ gzipData: false }, azureTableClient);

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);
//bot.set('storage', tableStorage);

//var qnaMakerTools = new builder_cognitiveservices.QnAMakerTools();
//bot.library(qnaMakerTools.createLibrary());
var qnaMakerTools = new QnAMakerDialogSerialNum.QnAMakerDialogSerialNum();
bot.library(qnaMakerTools.createLibrary());

// Recognizer and and Dialog for GA QnAMaker service
var recognizer = new builder_cognitiveservices.QnAMakerRecognizer({
    knowledgeBaseId: process.env.QnAKnowledgebaseId,
    authKey: process.env.QnAAuthKey || process.env.QnASubscriptionKey, // Backward compatibility with QnAMaker (Preview)
    endpointHostName: process.env.QnAEndpointHostName,
    top: 3
});
/*
var basicQnAMakerDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [recognizer],
    defaultMessage: 'I am not sure I can answer this question. You can ask me about the Texas Workforce Commission, Texas Industry Cluster, Occupation and Wages for Texans. Type #help for more options.',
    qnaThreshold: 0.3
}
);
*/

bot.on('conversationUpdate', function (message) {
  if (message.membersAdded && message.membersAdded.length > 0) {
    message.membersAdded.forEach(function (identity) {
      if (identity.id === message.address.bot.id) {
        bot.send(new builder.Message().address(message.address).text('Hello, I am an Interactive Virtual Assistant' +
            ' (iVA) that can help answer your questions about the eight Texas Industry Clusters. You can ask me questions like' +
            ' “What is the Texas Workforce Commission?” and “What are the Texas Industry Clusters?”. For all other questions type #help.'));
        bot.send(new builder.Message().address(message.address).text('How can I help you? '));
      }
    });
  }
});

const basicQnAMakerDialog = new builder_cognitiveservices.QnAMakerDialog({
    recognizers: [recognizer],
    defaultMessage: 'I am not sure I can answer this question. You can ask me about the Texas Workforce Commission, Texas Industry Cluster, Occupation and Wages for Texans. Type #help for more options.',
    qnaThreshold: 0.3,
    feedbackLib: qnaMakerTools
});
const basicQnAMakerDialog2 = basicQnAMakerDialog;

basicQnAMakerDialog.respondFromQnAMakerResult = (session, qnaMakerResult) => {
  var question = session.message.text;
  if(question == "#help") {
        var adaptiveCardMessage = new builder.Message(session)
        .addAttachment({
            contentType: "application/vnd.microsoft.card.adaptive",
            content: {
                type: "AdaptiveCard",
                "width": "auto",
                   body: [
                        {
                            "type": "TextBlock",
                            "text": "What would you like assistance with?",
                            "wrap": true
                        }
                    ],
                    "actions": [
                        {
                            "type": "Action.Submit",
                            "title": "Texas Workforce Commission",
                            "data": "Texas Workforce Commission",
                            "wrap": true
                        },
                        {
                            "type": "Action.Submit",
                            "title": "Jobs Y’all",
                            "data": "Jobs Y’all",
                            "wrap": true
                        }
                    ]
            }
        }); 
//        console.log(session.message.address.channelId);
        session.send(adaptiveCardMessage);
        session.endDialog();
      }
      else {
          session.send(qnaMakerResult.answers[0].answer);
      }
};

basicQnAMakerDialog.defaultWaitNextMessage = (session, qnaMakerResult) => {
    const phone_number =  session.message.user.id;
    var area_code = "";
    var source = "Website";
    const query = session.privateConversationData.qnaFeedbackUserQuestion;    
    const question = _.get(qnaMakerResult, 'answers[0].questions[0]');
    const answer = _.get(qnaMakerResult, 'answers[0].answer') || "No Answer";
    if(PhoneNumber( phone_number ).isValid()) {
        var phone = phone_number.replace( /^\+?[10]/, '' ).replace( /[^0-9]/g, '' ).match( /^([0-9]{3})/ );
        area_code = phone[1];
        source = "Mobile";    
    }    
    
    SQLProcessing.saveDialog(query, _.unescape(question), _.unescape(answer), source, area_code)
        .then(() => {
            console.log('ok')
        })
        .catch((oErr) => {
            console.log(oErr);
        });

    console.log('Area number: ' + area_code);
    console.log('User Query: ' + query);
    console.log('KB Question: ' + _.unescape(question));
    console.log('KB Answer: ' + _.unescape(answer));

    session.endDialog();
};


bot.dialog('basicQnAMakerDialog', basicQnAMakerDialog);

bot.dialog('/', basicQnAMakerDialog);
