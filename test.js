 const axios = require('axios');
 const express = require('express');

 const app = express();

 app.post('/test', (req, res,next)=>
 {
    let data ={...req.body, status:200};
    console.log(req.body);
    res.status(200).send(req.body);
 });

 app.get('/test', (req, res, next)=>{

    res.status(200).send({status:200, message:'Welcome to my test get operation'});
 });

 const test = async()=>
 {
    const url ='http://localhost:3200/test';
    const getResult =await axios.get(url);
    console.log('Axios Await Result \n', getResult);
 }
 test();
 app.listen(3200, ()=>console.log(`Server is listening to PORT 3200`));
