// Import Libraries

const express = require('express')
const { getConnection } = require('./models/db');

//init app
const app = express()

const dns = require('dns');

// Debugging: Force Google DNS to prevent ECONNREFUSED errors in some networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

require('dotenv/config')

app.use(express.json());

// routes 
app.use('/api/clients', require('./routes/clients'));
// const authRoute = require('./routes/auth')

// app.use('/wall', wallRoute)
// app.use('/api/user', authRoute)

// Root Endpoint (Health check)
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Middleware running perfectly',
    status: 'Active',
    env: 'Development'
  });

});



getConnection();

const PORT= process.env.PORT || 3000; 

// server initialization 
app.listen(PORT, ()=>{
    console.log('Server is up and running...');

});