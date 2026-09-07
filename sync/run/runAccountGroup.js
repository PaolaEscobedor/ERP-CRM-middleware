const { runSync } = require('../orchestrator.js');

const config = require('../../config/AccountGroup.js');

runSync(config, 'Account Group')
    .then(result => {
        console.log('Account Group sync result:', result);
    })
    .catch(error => {
        console.error('Error during Account Group sync:', error);
    });

