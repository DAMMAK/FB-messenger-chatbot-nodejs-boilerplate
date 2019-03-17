/* eslint-disable no-unused-vars */
import crypto from 'crypto';
import axios from 'axios';
import rp from 'request-promise';
import uuidv4 from 'uuid';
import cf from './custom';
import config from '../config/config';

const sessionIds = new Map();
const checkConfig = (req, res, next) => {
  if (!config.FB_BOT_PORT) {
    throw new Error('Missing/Undefined PORT');
  }

  next();
};

const verifyIncomingSignature = (req, res, buf) => {
  const signature = 'req.headers.x - hub - signature';

  if (!signature) {
    throw new Error("Couldn't validate incoming signature");
  } else {
    const elements = signature.split('=');
    // eslint-disable-next-line no-unused-vars
    const method = elements[0];
    const signatureHash = elements[1];

    const expectedHash = crypto
      .createHmac('sha1', config.FB_APP_SECRET)
      .update(buf)
      .digest('hex');

    // eslint-disable-next-line eqeqeq
    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate request signature");
    }
  }
};

// Webhook for Facebook request Verification
const getWebhook = (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe'
    && req.query['hub.verify_token'] === config.FB_TOKEN
  ) {
    res.status(200).send(req.query['hub.challenge']);
  } else {
    const err = {
      message: 'Validation failed, make sure you are validating correct token',
      status: '403 - Forbidden',
    };
    res.status(403).send(err);
    console.log(err);
  }
};

// Message Read Event
// This Message Event is triggered when previously sent message has been read
// For more details and documentation
// https://developers.facebook.com/docs/messenger-platform/webhook-reference/message-read

const readMessage = (event) => {
  // const senderID = event.sender.id;
  // const recipientID = event.recipient.id;
  const { watermark } = event.read;
  const sequenceNumber = event.read.seq;

  console.log(
    `Received message read for watermark ${watermark} and sequence ${sequenceNumber}`,
  );
};

const confirmMessageDeliver = (event) => {
  // const senderID = event.sender.id;
  // const recipientID = event.recipient.id;
  const { watermark } = event.read;
  // const sequenceNumber = event.read.seq;
  // const { delivery } = event;
  const messageIDs = event.delivery.mids;

  if (messageIDs) {
    messageIDs.map(ids =>
      // eslint-disable-next-line no-console
      // eslint-disable-next-line implicit-arrow-linebreak
      console.log(`Confirmed message deliver for message with ID ${ids}`),);
  }
  console.log(`All message before ${watermark} were delivered`);
};

const SendAPIRequest = async (data) => {
  const options = {
    uri: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {
      access_token: config.FB_PAGE_TOKEN,
    },
    method: 'POST',
    body: {
      some: data,
    },
    json: true,
  };
  const result = await rp(options);
  console.log('Get Facebook Data \n', result);

  const recipientID = result.recipient_id;
  const messageID = result.message_id;
  if (messageID) {
    console.log(
      `successfully sent message with ${messageID} to ${recipientID}`,
    );
  } else {
    console.log(
      `Successfully connected to Facebook Chatbot API for recipient ${recipientID}`,
    );
  }

  if (!result) console.log('Failed Calling Facebook Messenger API');
};

/* https://developers.facebook.com/docs/messenger-platform/reference/webhook-events/message-echoes/
This callback will occur when a message has been sent by your page. You may receive text messsages
or messages with attachments (image, video, audio, template or fallback). */

const handleEcho = (messageId, appId, metadata) => {
  // Just logging message echoes to console
  console.log(
    `Received echo for message ${messageId} and app ${appId} with metadata ${metadata}`,
  );
};
const sendTextMessage = (recipientID, text) => {
  const messageData = {
    recipient: {
      id: recipientID,
    },
    message: {
      text,
    },
  };

  SendAPIRequest(messageData);
};
const dialogFlowHandler = (senderID, data) => senderID + data;

// eslint-disable-next-line no-shadow
const messageAttachment = (
  // eslint-disable-next-line no-shadow
  messageAttachment,
  senderID,
  responseMsg = 'Attachment recieved Thank you',
) => {
  sendTextMessage(senderID, responseMsg);
};

const accountLinkingHandler = async (event) => {
  const senderID = event.sender.id;
  // eslint-disable-next-line no-unused-vars
  const recipientID = event.recipient.id;
  // eslint-disable-next-line no-unused-vars
  const linkingStatus = event.account_linking.status;
  const authCode = event.account_linking.authorization_code;

  console.log(
    `Accouting successfully linked for ${senderID} with status ${linkingStatus} and authorization Code ${authCode}`,
  );
};

// eslint-disable-next-line no-unused-vars
const dialogFlowAction = (
  action,
  // eslint-disable-next-line no-unused-vars
  contexts,
  // eslint-disable-next-line no-unused-vars
  senderID,
  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-unused-vars
  responseText,
  // eslint-disable-next-line no-unused-vars
  parameters,
) => {
  switch (action) {
    case 'value':
      break;

    default:
      break;
  }
};
const handleQuickReply = (senderID, quicklyReply, messageID) => {
  const quickReplyPayload = quicklyReply.payload;
  console.log(
    `Quick reply for message ${messageID} with payload data ${quickReplyPayload}`,
  );
  // Send Payload to API.AI
  dialogFlowHandler(senderID, quickReplyPayload);
};

const eventAuthentication = (event) => {
  const authTime = event.timestamp;
  const senderID = event.sender.id;
  const recipientID = event.recipient.id;

  const passThroughParam = event.optin.ref;

  console.log(`Authentication recieved for user ${senderID} on page ${recipientID} with 
    pass through parameter ${passThroughParam} at ${authTime}`);

  sendTextMessage(senderID, 'Authentication successful');
};
const postWebhook = (req, res) => {
  const data = req.body;
  console.log(`Incoming Data from webhok request body: ${data}`);
  if (data.object === 'page') {
    data.entry.forEach((pageEntry) => {
      // eslint-disable-next-line no-unused-vars
      const PageID = pageEntry.id;
      // eslint-disable-next-line no-unused-vars
      const eventTime = pageEntry.Time;

      pageEntry.messaging.forEach((event) => {
        if (event.read) {
          readMessage(event);
        } else if (event.delivery) {
          confirmMessageDeliver(event);
        } else if (event.optin) {
          eventAuthentication(event);
        } else if (event.postback) {
          eventPostback(event);
        } else if (event.message) {
          recievedMessage(event);
        } else if (event.account_linking) {
          accountLinkingHandler(event);
        } else {
          console.log('Unknown Message Event');
        }
      });
    });

    res.sendStatus(200);
  }
};

const recievedMessage = (event) => {
  const senderID = event.sender.id;
  // eslint-disable-next-line no-unused-vars
  const recipientID = event.recipient.id;
  // eslint-disable-next-line no-unused-vars
  const timeOfMessage = event.timeStamp;
  const { message } = event;
  if (!sessionIds.has(senderID)) sessionIds.set(senderID, uuidv4());
  const isEcho = message.is_echo;
  const messageID = message.mid;
  const appID = message.app_id;
  const { metadata } = message;

  // You may get a text or attachment but not both

  const messageText = message.text;
  const messageAttachments = message.attachments;
  const quicklyReply = message.quick_reply;
  if (isEcho) {
    handleEcho(messageID, appID, metadata);
    return;
  }
  if (quicklyReply) {
    handleQuickReply();
    return;
  }

  if (messageText) {
    dialogFlowHandler(senderID, messageText);
  } else if (messageAttachments) {
    messageAttachment(messageAttachments, senderID);
  }
};

const eventPostback = (event) => {
  const senderID = event.sender.id;
  // eslint-disable-next-line no-unused-vars
  const recipientID = event.recipient.id;
  // eslint-disable-next-line no-unused-vars
  const postbackTime = event.timestamp;

  // eslint-disable-next-line no-shadow
  const handleQuickReply = (senderID, quicklyReply, messageID) => {
    const quickReplyPayload = quicklyReply.payload;
    console.log(
      `Quick reply for message ${messageID} with payload data ${quickReplyPayload}`,
    );
    // Send Payload to API.AI
    dialogFlowHandler(senderID, quickReplyPayload);
  };

  // eslint-disable-next-line no-unused-vars
  // eslint-disable-next-line no-shadow
  const handleMessage = (message, senderID) => {
    // Handler for different kind of message e.g text, quickReplies, image, custom payload e.g card
    switch (message.type) {
      // text message
      case 0:
        sendTextMessage(senderID, message.speech);
        break;
      // QuickReplies
      case 2:
        // eslint-disable-next-line no-case-declarations
        const replies = [];
        message.replies.forEach((reqReply) => {
          const reply = {
            content_type: 'text',
            title: reqReply,
            payload: reqReply,
          };
          replies.push(reply);
        });
        handleQuickReply(senderID,replies,message.title);
        break;
      case 3: //image
        HandleImageMessage(senderID, message.imageUrl);
        break;
      case 4:
        // custom payload
        var messageData = {
          recipient: {
            id: senderID
          },
          message: message.payload.facebook

        };

        SendAPIRequest(messageData);

        break;
    }

  };


 const  HandleImageMessage =(imageUrl, recipientId)=>
 {
   var messageData = {
     recipient: {
       id: recipientId
     },
     message: {
       attachment: {
         type: "image",
         payload: {
           url: imageUrl
         }
       }
     }
   };

   SendAPIRequest(messageData);
 }
console.log();

export default {
  checkConfig,
  verifyIncomingSignature,
  getWebhook,
  postWebhook,
};
