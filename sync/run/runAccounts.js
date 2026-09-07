const { runSync } = require('../orchestrator.js');
const config = require('../../config/Accounts.config.js');

runSync(config, 'Accounts')
    .then(result => {
        console.log('Accounts sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Accounts sync:', error);
        process.exit(1);
    });