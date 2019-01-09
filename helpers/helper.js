import config from '../config/config';
import crypto from 'crypto';
import axios from 'axios';

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

                }
            });
            

        })
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

}

export default {
    checkConfig,
    verifyIncomingSignature,
    getWebhook,
    postWebhook
}