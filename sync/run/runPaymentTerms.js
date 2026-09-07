const { runSync } = require('../orchestrator');

const config = require('../../config/salesPaymentTerms.config.js');

runSync(config, 'Payment Terms')
    .then(result => {
        console.log('Payment Terms sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Payment Terms sync:', error);
        process.exit(1);
    });

