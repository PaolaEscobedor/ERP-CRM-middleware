const { runSync } = require('../orchestrator.js');

const config = require('../../config/salesPaymentForms.config.js');

runSync(config, 'Payment Form')
    .then(result => {
        console.log('Payment Form sync result:', result);
    })
    .catch(error => {
        console.error('Error during Payment Form sync:', error);
    });

