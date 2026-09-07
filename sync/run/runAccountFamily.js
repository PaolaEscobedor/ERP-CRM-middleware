const { runSync } = require('../orchestrator.js');

const config = require('../../config/AccountFamily.config.js');

runSync(config, 'Account Family')
    .then(result => {
        console.log('Account Family sync result:', result);
    })
    .catch(error => {
        console.error('Error during Account Family sync:', error);
    });

