import config from '../config/config';
import crypto from 'crypto';
import axios from 'axios';
import rp from 'request-promise';
import cf from '../helpers/custom';
import uuidv4  from 'uuid';


const sessionIds = new Map();
const checkConfig=(req, res, next)=>
{

if(!config.FB_BOT_PORT)
    throw new Error('Missing/Undefined PORT');

    next();
}

const verifyIncomingSignature=(req, res, buf)=>
{
    let signature = req.headers.x-hub-signature;

    if(!signature) {
        throw new Error(`Couldn't validate incoming signature`);

    }
    else{
        let elements = signature.split("=");
        let method = elements[0];
        let signatureHash = elements[1];

        let expectedHash = crypto.createHmac('sha1',config.FB_APP_SECRET)
        .update(buf).digest('hex');

        if(signatureHash !=expectedHash)
            throw new Error(`Couldn't validate request signature`);
    }
    
}

// Webhook for Facebook request Verification
const getWebhook =(req,res,next)=>{
    if(req.query['hub.mode']==='subscribe' && req.query['hub.verify_token'] ===config.FB_TOKEN){
        res.status(200).send(req.query['hub.challenge']);
    }
    else{
        const err={
            message:'Validation failed, make sure you are validating correct token',
            status:'403 - Forbidden'
        };
        res.status(403).send(err);
        console.log(err);
    }
}

const postWebhook =(req, res, next) => {
    let data = req.body;
    console.log(`Incoming Data from webhok request body: ${data}`);
    if(data.object == 'page') {
        data.entry.forEach((pageEntry)=>{
            let PageID = pageEntry.id;
            let eventTime =pageEntry.Time;

            pageEntry.messaging.forEach((event)=>{
                if(event.read){
                    readMessage(event);
                }
                else if(event.delivery){
                    confirmMessageDeliver(event);
                }
                else if(event.optin){
                    eventAuthentication(event);
                }
                else if(event.postback){
                    eventPostback(event);
                }
                else if(event.message){
                    recievedMessage(event);
                }
                else if(event.account_linking)
                {
                    accountLinkingHandler(event);
                }
                else{
                    console.log(`Unknown Message Event`);
                }
            });
            

        });

        res.sendStatus(200);
    }
    
}
//Message Read Event
//This Message Event is triggered when previously sent message has been read
// For more details and documentation
//https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read

const readMessage=(event)=>{
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let watermark = event.read.watermark;
    let sequenceNumber = event.read.seq;

    console.log(`Received message read for watermark ${watermark} and sequence ${sequenceNumber}`);

}

const confirmMessageDeliver=(event)=>
{
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let watermark = event.read.watermark;
    let sequenceNumber = event.read.seq;
    let delivery = event.delivery;
    let messageIDs = event.delivery.mids;

    if(messageIDs){
        messageIDs.map((ids)=>console.log(`Confirmed message deliver for message with ID ${messageIDs}`));
    }
    console.log(`All message before ${watermark} were delivered`);
    
}

const eventAuthentication=(event)=>
{
    let authTime = event.timestamp;
    let senderID =event.sender.id;
    let recipientID = event.recipient.id;
    
    let passThroughParam = event.optin.ref;

    console.log(`Authentication recieved for user ${senderID} on page ${recipientID} with 
    pass through parameter ${passThroughParam} at ${authTime}`);

    sendTextMessage(senderID, "Authentication successful");
}

const sendTextMessage=(recipientID, text)=>{
    let messageData ={
        recipient:{
            id:recipientID   
        },
        message:{
            text
        }
    }

    SendAPIRequest(messageData);
}

const SendAPIRequest=(data)=>
{
    let options ={
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs:{
            access_token: config.FB_PAGE_TOKEN,
        },
        method: 'POST',
        body:{
           some:messageData,
        },
        json:true
    }
  const result = await rp(options);
  console.log('Get Facebook Data \n', getResult);

  let recipientID =result.recipient_id;
  let messageID = result.message_id;
  if(messageID){
    console.log(`successfully sent message with ${messageID} to ${recipientID}`);
  }
  else
  {
      console.log(`Successfully connected to Facebook Chatbot API for recipient ${recipientID}`);
      
  }

  if(!result) console.log(`Failed Calling Facebook Messenger API`);
  

      
  
}

const eventPostback=(event)=> {
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let postbackTime = event.timestamp;

    let payload = event.postback.payload;

    switch(payload){
        case "GET_STARTED":
            cf.GET_STARTED();
        break;

        default:
        sendTextMessage(senderID,config.PAYLOAD_DEFAULT_MESSAGE);
        console.log(`${senderID} ${config.PAYLOAD_DEFAULT_MESSAGE}`);
    }

    console.log();
    
}

const recievedMessage= ()=>
{
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;
    let timeOfMessage = event.timeStamp;
    let message = event.message;
    if(!sessionIds.has(senderID)) sessionIds.set(senderID, uuidv4());
    let isEcho = message.is_echo;
    let messageID= message.mid;
    let appID= message.app_id;
    let metadata= message.metadata;

    //You may get a text or attachment but not both

    let messageText = message.text;
    let messageAttachments = message.attachments;
    let quicklyReply = message.quick_reply;
    if(isEcho){
        handleEcho(messageID, appID, metadata);
        return;
    }
    else if(quicklyReply){
        handleQuickReply();
        return;
    }

    if(messageText){
        dialogFlowHandler(senderID, messageText);
    }
    else if (messageAttachments){
        messageAttachment(messageAttachments, senderID);
    }
}
/*https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/message-echoes/
This callback will occur when a message has been sent by your page. You may receive text messsages 
or messages with attachments (image, video, audio, template or fallback).*/

const handleEcho=(messageId, appId, metadata)=>
{
    //Just logging message echoes to console
    console.log(`Received echo for message ${messageId} and app ${appId} with metadata ${metadata}`);
    
}

const handleQuickReply=(senderID, quicklyReply,messageID)=>{
    let quickReplyPayload = quicklyReply.payload;
    console.log(`Quick reply for message ${messageID} with payload data ${quickReplyPayload}`);
    // Send Payload to API.AI
    dialogFlowHandler(senderID, quickReplyPayload);
}

const handleMessage = (message, senderID)=>
{
    // Handler for different kind of message e.g text, quickReplies, image, custom payload e.g card
    switch (message.type) {
        //text message
        case 0:
            sendTextMessage(senderID, message.speech);
            break;
        //QuickReplies
        case 2: 
        let replies =[];
            message.replies.forEach((reqReply)=>
            {
                let reply ={
                    "content_type": "text",
                    "title": reqReply,
                    "payload": reqReply
                }
            replies.push(reply);
            });
        handleQuickReply
        default:
            break;
    }
}

const dialogFlowHandler=(senderID, data)=>
{

}

const messageAttachment =(messageAttachment, senderID, responseMsg=`Attachment recieved Thank you`){
    sendTextMessage(senderID, responseMsg);
}

const accountLinkingHandler =(event)=>
{
    let senderID = event.sender.id;
    let recipientID = event.recipient.id;

    let linkingStatus = event.account_linking.status;
    let authCode = event.account_linking.authorization_code;

    console.log(`Accouting successfully linked for ${senderID} with status ${status} and authorization Code ${authCode}`)
}

const dialogFlowAction=(action, contexts, senderID,responseText, parameters)=>
{
    switch (action) {
        case "value":
            
            break;
    
        default:
            break;
    }
}

export default {
    checkConfig,
    verifyIncomingSignature,
    getWebhook,
    postWebhook
}