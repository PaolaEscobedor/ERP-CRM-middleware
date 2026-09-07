const { runSync } = require('../orchestrator.js');
const config = require('../../config/AccountBranches.config.js');

runSync(config, 'account_branches')
    .then(result => {
        console.log('Account branches sync result:', result);
        process.exit(0);
    })
    .catch(error => {
        console.error('Error during Account branches sync:', error);
        process.exit(1);
    });