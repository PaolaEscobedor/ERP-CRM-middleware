// Import Libraries

require('dotenv/config');
const express = require('express')
const syncRoutes = require('./routes/syncRoutes');

//init app
const app = express()

//const dns = require('dns');

// Debugging: Force Google DNS to prevent ECONNREFUSED errors in some networks
//dns.setServers(['8.8.8.8', '8.8.4.4']);


app.use(express.json());
app.use(express.urlencoded({ extended: false })); // required for the OAuth token request


// routes 
app.use('/api/v1', syncRoutes);



// Root Endpoint (Health check)
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Middleware running',
    status: 'Active',

  });

});



const PORT= process.env.PORT || 3000; 

// server initialization 
app.listen(PORT, ()=>{
    console.log('Server is up and running...');

});