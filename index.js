import express from 'express';
import apiai from 'apiai';
import config from './config/config';
import helper from './helpers/helper';


const app = express();


app.get('/',(req,res,next)=> {
    res.send('Welcome to my chat bot');
});

app.get('/webhook', helper.getWebhook);

app.post('/webhook',helper.getWebhook);

 app.listen(3500);
