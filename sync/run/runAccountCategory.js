const { runSync } = require('../orchestrator.js');

const config = require('../../config/AccountCategory.config.js');

runSync(config, 'Account Category')
    .then(result => {
        console.log('Account Category sync result:', result);
    })
    .catch(error => {
        console.error('Error during Account Category sync:', error);
    });

